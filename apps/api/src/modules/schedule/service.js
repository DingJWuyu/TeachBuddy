/**
 * Schedule business operations.
 *
 * The service owns every domain rule the contract fixes for entries,
 * occurrences, exceptions, range queries, settings and atomic item moves. It
 * runs either inside a `mutations.execute` transaction (HTTP writes) or as a
 * plain synchronous call (public port reads), never returns a Promise and does
 * no network I/O; cross-module reads go through the injected classes/lessons
 * ports, which throw `{status, problem}` contract errors.
 */
import { contractError, invalidInput, problems } from '../../workbench/problems.js';
import { scheduleProblems } from './problems.js';
import {
  addDays,
  compareDates,
  formatIsoZ,
  instantAt,
  localPartsAt,
  isDate,
  isTimeOfDay,
  isTimeZone,
  parseInstant,
  parseTimeOfDay,
  rangeInstants
} from './time.js';
import {
  buildOccurrence,
  dueInstantMs,
  effectiveContent,
  effectiveLinks,
  fitsSeries,
  instanceState,
  isRepeating,
  intersects,
  listReminderCandidates,
  seriesOriginDates,
  sortOccurrences,
  stripInternal,
  templateContent
} from './occurrences.js';

export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';
export const LESSON_LABEL_FALLBACK = '未命名备课';

const EMPTY_COURSE = Object.freeze({ classId: null, lessonId: null, recordIds: [] });
const EMPTY_LINKS = Object.freeze({ classroom: null, lesson: null, records: [] });

function emptyLinks() {
  return { classroom: null, lesson: null, records: [] };
}

function randomUuid() {
  return globalThis.crypto.randomUUID();
}

function sameReminder(left, right) {
  if (!left || !right) return left === right;
  return left.side === right.side && left.minutes === right.minutes && (left.anchor ?? 'end') === (right.anchor ?? 'end');
}

function sameTime(left, right) {
  if (!left || !right) return left === right;
  return left.date === right.date
    && left.startTime === right.startTime
    && left.timeZone === right.timeZone
    && left.durationMinutes === right.durationMinutes;
}

function displayLessonLabel(title) {
  const text = typeof title === 'string' ? title.trim() : '';
  return text === '' ? LESSON_LABEL_FALLBACK : title;
}

function normalizeContent(value) {
  const repeat = value.repeat ?? null;
  return {
    title: value.title,
    items: value.items.map((item) => ({ id: item.id, text: item.text, priority: item.priority,
      ...(Object.hasOwn(item, 'completed') ? { completed: item.completed } : {}) })),
    time: value.time === null ? null : { ...value.time },
    repeat: repeat === null ? null : { ...repeat },
    ...(value.calendar ? { calendar: structuredClone(value.calendar) } : {}),
    course: {
      classId: value.course.classId,
      lessonId: value.course.lessonId,
      recordIds: [...value.course.recordIds]
    },
    reminder: value.reminder === null ? null : { side: value.reminder.side, minutes: value.reminder.minutes, ...(value.reminder.anchor ? { anchor: value.reminder.anchor } : {}) }
  };
}

function overrideView(content) {
  return {
    title: content.title,
    items: content.items,
    time: content.time,
    course: content.course,
    reminder: content.reminder,
    ...(content.calendar ? { calendar: content.calendar } : {})
  };
}

function parseNow(clock) {
  const value = clock.now();
  const ms = value instanceof Date ? value.getTime() : parseInstant(String(value));
  if (Number.isNaN(ms)) throw new Error('Schedule clock returned an invalid instant.');
  return { ms, iso: formatIsoZ(ms) };
}

export function createScheduleService({ repository, classes, lessons, beforeChange, clock }) {
  if (!repository) throw new TypeError('createScheduleService requires a repository.');
  if (!classes || typeof classes.readClass !== 'function' || typeof classes.readRecord !== 'function') {
    throw new TypeError('createScheduleService requires the classes.readClass/readRecord ports.');
  }
  if (!lessons || typeof lessons.readForTeachingLink !== 'function') {
    throw new TypeError('createScheduleService requires the lessons.readForTeachingLink port.');
  }
  if (typeof beforeChange !== 'function') {
    throw new TypeError('createScheduleService requires a synchronous beforeChange seam.');
  }
  if (!clock || typeof clock.now !== 'function') {
    throw new TypeError('createScheduleService requires a clock.');
  }

  function nowStamp() {
    return parseNow(clock).iso;
  }

  function readSettings(accountKey) {
    let row = repository.readSettings(accountKey);
    if (row) return row;
    const now = nowStamp();
    repository.insertSettings({
      accountKey,
      timeZone: DEFAULT_TIME_ZONE,
      version: 1,
      createdAt: now,
      updatedAt: now
    });
    row = repository.readSettings(accountKey);
    return row;
  }

  function readEntryOrThrow(principal, id) {
    const entry = repository.findEntry(principal.accountKey, id);
    if (!entry) throw contractError(problems.notFound());
    return entry;
  }

  function readActiveEntry(principal, id) {
    const entry = readEntryOrThrow(principal, id);
    if (entry.deletedAt) throw contractError(problems.objectDeleted());
    return entry;
  }

  function assertVersion(entry, expectedVersion) {
    if (entry.version !== expectedVersion) {
      throw scheduleProblems.versionConflict(entry.id, entry.version);
    }
  }

  /** Title-or-item rule plus the null couplings the contract fixes. */
  function assertContentRules(content, { repeatingTemplate }) {
    if (content.title.trim() === '' && content.items.length === 0) {
      throw invalidInput('/title', 'empty-content');
    }
    if (content.time === null) {
      if (content.repeat !== null) throw invalidInput('/repeat', 'invalid-type');
      if (content.reminder !== null) throw invalidInput('/reminder', 'invalid-type');
      if (content.course.recordIds.length > 0) throw invalidInput('/course/recordIds', 'invalid-type');
    } else {
      if (!isTimeZone(content.time.timeZone)) throw scheduleProblems.invalidTimeZone('/time/timeZone');
      if (!isTimeOfDay(content.time.startTime)) throw invalidInput('/time/startTime', 'out-of-range');
      if (content.repeat !== null && compareDates(content.repeat.until, content.time.date) < 0) {
        throw invalidInput('/repeat/until', 'out-of-range');
      }
      if (repeatingTemplate && content.repeat !== null && content.course.recordIds.length > 0) {
        throw invalidInput('/course/recordIds', 'out-of-range');
      }
    }
    if (content.course.recordIds.length > 0 && content.course.classId === null) {
      throw invalidInput('/course/recordIds', 'invalid-reference');
    }
  }

  /** Due instant of a content projection placed on a concrete origin date. */
  function dueFor(content, originDate) {
    const placed = originDate === null || !content.time
      ? content
      : { ...content, time: { ...content.time, date: originDate } };
    return dueInstantMs(placed);
  }

  function assertReminderFuture(content, previous, nowMs, { repeatingTemplate }) {
    if (content.reminder === null || content.time === null) return;
    // An unchanged past configuration survives text, item and course edits; a
    // newly enabled or adjusted due instant must still be in the future.
    const unchanged = previous
      && sameReminder(previous.reminder, content.reminder)
      && sameTime(previous.time, content.time)
      && (previous.repeat?.until ?? null) === (content.repeat?.until ?? null);
    if (unchanged) return;
    if (repeatingTemplate) {
      const hasFuture = seriesOriginDates({ time: content.time, repeat: content.repeat })
        .some((originDate) => {
          const dueMs = dueFor(content, originDate);
          return dueMs !== null && dueMs > nowMs;
        });
      if (!hasFuture) throw scheduleProblems.reminderNotFuture('/reminder');
      return;
    }
    const dueMs = dueFor(content, null);
    if (dueMs === null) return;
    const previousDue = previous && previous.reminder && previous.time ? dueFor(previous, null) : null;
    const changed = !previous
      || !sameReminder(previous.reminder, content.reminder)
      || previousDue !== dueMs;
    if (changed && dueMs <= nowMs) throw scheduleProblems.reminderNotFuture('/reminder');
  }

  /**
   * Resolve course links through the public ports. New or changed links must
   * point at active objects; an unchanged deleted link stays readable.
   */
  function resolveCourse(principal, course, previousLinks) {
    const links = emptyLinks();
    const previous = previousLinks ?? EMPTY_LINKS;

    if (course.classId !== null) {
      const reference = classes.readClass(principal, course.classId);
      const changed = !previous.classroom || previous.classroom.id !== course.classId;
      if (changed && reference.deletedAt !== null) throw scheduleProblems.referenceDeleted();
      links.classroom = {
        id: course.classId,
        labelAtLink: changed ? reference.name : previous.classroom.labelAtLink
      };
    }

    if (course.lessonId !== null) {
      const reference = lessons.readForTeachingLink(principal, course.lessonId);
      const changed = !previous.lesson || previous.lesson.id !== course.lessonId;
      if (changed && reference.deletedAt !== null) throw scheduleProblems.referenceDeleted();
      links.lesson = {
        id: course.lessonId,
        labelAtLink: changed ? reference.title : previous.lesson.labelAtLink
      };
    }

    const previousRecords = new Map((previous.records ?? []).map((record) => [record.id, record]));
    if (course.recordIds.length > 0) {
      links.records = course.recordIds.map((recordId) => {
        const reference = classes.readRecord(principal, recordId);
        if (reference.classId !== course.classId) throw scheduleProblems.classMismatch();
        const existing = previousRecords.get(recordId);
        if (!existing && reference.deletedAt !== null) throw scheduleProblems.referenceDeleted();
        return {
          id: recordId,
          labelAtLink: existing ? existing.labelAtLink : reference.label
        };
      });
    }

    return links;
  }

  /** Derived link state for responses; a failing source read fails the read. */
  function buildCourseState(principal, course, links) {
    const stored = links ?? EMPTY_LINKS;
    const state = { classroom: null, lesson: null, records: [] };
    if (course.classId !== null) {
      const reference = classes.readClass(principal, course.classId);
      state.classroom = {
        id: course.classId,
        labelAtLink: stored.classroom?.labelAtLink ?? reference.name,
        currentLabel: reference.name,
        deleted: reference.deletedAt !== null
      };
    }
    if (course.lessonId !== null) {
      const reference = lessons.readForTeachingLink(principal, course.lessonId);
      state.lesson = {
        id: course.lessonId,
        labelAtLink: stored.lesson?.labelAtLink ?? reference.title,
        currentLabel: displayLessonLabel(reference.title),
        deleted: reference.deletedAt !== null
      };
    }
    state.records = course.recordIds.map((recordId) => {
      const reference = classes.readRecord(principal, recordId);
      const link = (stored.records ?? []).find((record) => record.id === recordId);
      return {
        id: recordId,
        labelAtLink: link?.labelAtLink ?? reference.label,
        currentLabel: reference.label,
        deleted: reference.deletedAt !== null
      };
    });
    return state;
  }

  function entryView(principal, entry) {
    return {
      id: entry.id,
      version: entry.version,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      deletedAt: entry.deletedAt,
      title: entry.title,
      items: entry.items,
      time: entry.time,
      repeat: entry.repeat,
      course: entry.course,
      reminder: entry.reminder,
      calendar: entry.calendar ?? { allDay: false, notes: '', tags: [] },
      courseState: buildCourseState(principal, entry.course, entry.courseLinks)
    };
  }

  function occurrenceView(principal, occurrence) {
    const view = stripInternal(occurrence);
    view.courseState = buildCourseState(principal, view.course, occurrence.__links);
    return view;
  }

  function exceptionMaps(entry) {
    const exceptions = repository.listExceptions(entry.id);
    return { byDate: new Map(exceptions.map((exception) => [exception.originDate, exception])) };
  }

  function occurrenceFor(principal, entry, originDate) {
    const { byDate } = exceptionMaps(entry);
    const exception = originDate === null ? null : byDate.get(originDate) ?? null;
    return buildOccurrence({
      entry,
      originDate,
      exception,
      links: effectiveLinks(entry, exception)
    });
  }

  function writeArmsForNewlyVisible(entry, previousUntil, nowIso) {
    for (const originDate of seriesOriginDates(entry)) {
      if (compareDates(originDate, previousUntil) > 0) {
        repository.writeArm({ entryId: entry.id, originDate, armedAt: nowIso });
      }
    }
  }

  function insertEntry(principal, content, links, now) {
    const entry = {
      id: randomUuid(),
      accountKey: principal.accountKey,
      version: 1,
      title: content.title,
      items: content.items,
      time: content.time,
      repeat: content.repeat,
      calendar: content.calendar ?? { allDay: false, notes: '', tags: [] },
      course: content.course,
      courseLinks: links,
      reminder: content.reminder,
      reminderArmedAt: now.iso,
      createdAt: now.iso,
      updatedAt: now.iso,
      deletedAt: null
    };
    repository.insertEntry(entry);
    return entry;
  }

  return {
    readForExport(principal) {
      const settings = repository.readSettings(principal.accountKey);
      return {
        entries: repository.listEntries(principal.accountKey).map(entry => ({
          entry: entryView(principal, entry), exceptions: repository.listExceptions(entry.id),
        })),
        settings: settings ? { timeZone: settings.timeZone, version: settings.version } : null,
      };
    },
    listLabels(principal) {
      return { items: repository.listLabels(principal.accountKey) };
    },
    createLabel(principal, body) {
      const label = { id: randomUuid(), accountKey: principal.accountKey, name: body.name.trim(), color: body.color };
      repository.insertLabel(label);
      return { id: label.id, name: label.name, color: label.color, version: 1 };
    },
    updateLabel(principal, id, body) {
      const label = repository.findLabel(principal.accountKey, id);
      if (!label) throw contractError(problems.notFound());
      assertVersion(label, body.expectedVersion);
      const updated = { ...label, accountKey: principal.accountKey, name: body.name.trim(), color: body.color,
        version: label.version + 1, deleted: body.deleted ? 1 : 0 };
      repository.writeLabel(updated);
      return { id, name: updated.name, color: updated.color, version: updated.version, deleted: Boolean(updated.deleted) };
    },
    getSettings(principal) {
      const row = readSettings(principal.accountKey);
      return { timeZone: row.timeZone, version: row.version };
    },

    updateSettings(principal, body) {
      if (!isTimeZone(body.timeZone)) throw scheduleProblems.invalidTimeZone('/timeZone');
      const row = readSettings(principal.accountKey);
      if (row.version !== body.expectedVersion) throw contractError(problems.versionConflict(row.version));
      const entries = repository.listEntries(principal.accountKey);
      const needsUpdate = entries.some(entry => entry.time && (entry.time.timeZone !== body.timeZone || repository.listExceptions(entry.id).some(exception => exception.content?.time && exception.content.time.timeZone !== body.timeZone)));
      if (row.timeZone === body.timeZone && !needsUpdate) return { timeZone: row.timeZone, version: row.version };
      const now = nowStamp();
      beforeChange(principal, now);
      for (const entry of entries) {
        if (!entry.time) continue;
        const exceptions = repository.listExceptions(entry.id);
        if (entry.time.timeZone === body.timeZone && !exceptions.some(exception => exception.content?.time && exception.content.time.timeZone !== body.timeZone)) continue;
        repository.writeEntry({ ...entry, time: { ...entry.time, timeZone: body.timeZone }, version: entry.version + 1, reminderArmedAt: now, updatedAt: now });
        for (const exception of exceptions) {
          if (exception.content?.time) repository.writeException({ ...exception, content: { ...exception.content, time: { ...exception.content.time, timeZone: body.timeZone } }, now });
        }
        for (const arm of repository.listArms(entry.id)) repository.writeArm({ ...arm, armedAt: now });
      }
      repository.writeSettings({
        accountKey: principal.accountKey,
        timeZone: body.timeZone,
        version: row.version + 1,
        updatedAt: now
      });
      const updated = repository.readSettings(principal.accountKey);
      return { timeZone: updated.timeZone, version: updated.version };
    },

    listEntries(principal, query) {
      const state = query.state ?? 'active';
      const placement = query.placement ?? 'all';
      return {
        items: repository
          .listEntries(principal.accountKey)
          .filter((entry) => (state === 'deleted' ? entry.deletedAt !== null : entry.deletedAt === null))
          .filter((entry) => (placement === 'unscheduled' ? entry.time === null : true))
          .map((entry) => entryView(principal, entry))
      };
    },

    getEntry(principal, id) {
      return entryView(principal, readEntryOrThrow(principal, id));
    },

    createEntry(principal, body) {
      const content = normalizeContent(body);
      const repeatingTemplate = content.repeat !== null;
      assertContentRules(content, { repeatingTemplate });
      const now = parseNow(clock);
      const links = resolveCourse(principal, content.course, EMPTY_LINKS);
      assertReminderFuture(content, null, now.ms, { repeatingTemplate });
      beforeChange(principal, now.iso);
      const entry = insertEntry(principal, content, links, now);
      return entryView(principal, entry);
    },

    updateEntry(principal, id, body) {
      const entry = readActiveEntry(principal, id);
      assertVersion(entry, body.expectedVersion);
      const content = normalizeContent(body);
      if (entry.repeat?.frequency && body.repeat && !body.repeat.frequency) content.repeat = { ...entry.repeat, until: body.repeat.until };
      const repeatingTemplate = content.repeat !== null;
      assertContentRules(content, { repeatingTemplate });

      if (!body.calendar && isRepeating(entry)) {
        if (content.repeat === null || content.time === null) throw scheduleProblems.immutableSeries();
        if (content.time.date !== entry.time.date || content.time.timeZone !== entry.time.timeZone) {
          throw scheduleProblems.immutableSeries();
        }
      } else if (!body.calendar && content.repeat !== null) {
        throw scheduleProblems.immutableSeries();
      }

      const now = parseNow(clock);
      const links = resolveCourse(principal, content.course, entry.courseLinks);
      const previousContent = { ...templateContent(entry), repeat: entry.repeat };
      assertReminderFuture(content, previousContent, now.ms, { repeatingTemplate });

      const timingChanged = !sameTime(previousContent.time, content.time)
        || JSON.stringify(previousContent.repeat) !== JSON.stringify(content.repeat)
        || !sameReminder(previousContent.reminder, content.reminder);

      beforeChange(principal, now.iso);

      // Moving a series back to an unscheduled task abandons its old instances.
      if (isRepeating(entry) && content.time === null) repository.clearSeries(entry.id);

      if (isRepeating(entry) && content.repeat && entry.repeat.until !== content.repeat.until) {
        writeArmsForNewlyVisible({ ...entry, time: content.time, repeat: content.repeat }, entry.repeat.until, now.iso);
      }

      const updated = {
        ...entry,
        version: entry.version + 1,
        title: content.title,
        items: content.items,
        time: content.time,
        repeat: content.repeat,
        calendar: content.calendar ?? entry.calendar,
        course: content.course,
        courseLinks: links,
        reminder: content.reminder,
        reminderArmedAt: timingChanged ? now.iso : entry.reminderArmedAt,
        updatedAt: now.iso,
        deletedAt: null
      };
      repository.writeEntry(updated);
      return entryView(principal, updated);
    },

    deleteEntry(principal, id, body) {
      const entry = readEntryOrThrow(principal, id);
      assertVersion(entry, body.expectedVersion);
      beforeChange(principal, parseNow(clock).iso);
      repository.deleteEntry(principal.accountKey, entry.id);
      return { id: entry.id, version: entry.version + 1 };
    },

    setEntryDeletion(principal, id, body) {
      const entry = readEntryOrThrow(principal, id);
      assertVersion(entry, body.expectedVersion);
      const now = parseNow(clock);
      beforeChange(principal, now.iso);
      if (body.deleted) {
        // The disabled period must stay silent: every instance falls back to
        // the restore-time arm instead of its previous one.
        for (const arm of repository.listArms(entry.id)) {
          repository.removeArm(entry.id, arm.originDate);
        }
      }
      const updated = {
        ...entry,
        version: entry.version + 1,
        updatedAt: now.iso,
        deletedAt: body.deleted ? now.iso : null,
        reminderArmedAt: now.iso
      };
      repository.writeEntry(updated);
      return entryView(principal, updated);
    },

    listExceptions(principal, id) {
      const entry = readEntryOrThrow(principal, id);
      const items = repository.listExceptions(entry.id).map((exception) => ({
        originDate: exception.originDate,
        mode: exception.mode,
        eligible: isRepeating(entry) ? compareDates(exception.originDate, entry.repeat.until) <= 0 : false,
        content: exception.mode === 'override' && exception.content ? overrideView(exception.content) : null
      }));
      return { entryId: entry.id, version: entry.version, items };
    },

    detachOccurrence(principal, id, originDate, body) {
      if (!isDate(originDate)) throw invalidInput('/originDate', 'out-of-range');
      const entry = readActiveEntry(principal, id);
      if (!isRepeating(entry) || !fitsSeries(entry, originDate) || compareDates(originDate, entry.repeat.until) > 0) throw contractError(problems.notFound());
      assertVersion(entry, body.expectedVersion);
      const existing = repository.findException(id, originDate);
      if (existing?.mode === 'cancelled') throw contractError(problems.notFound());
      const previous = existing?.mode === 'override' && existing.content ? existing.content : effectiveContent(entry, null, originDate);
      const content = normalizeContent(body);
      if (content.repeat !== null) throw invalidInput('/repeat', 'out-of-range');
      assertContentRules(content, { repeatingTemplate: false });
      const links = resolveCourse(principal, content.course, existing?.content?.courseLinks ?? entry.courseLinks);
      const now = parseNow(clock);
      assertReminderFuture(content, previous, now.ms, { repeatingTemplate: false });
      beforeChange(principal, now.iso);
      repository.writeException({ entryId: id, originDate, mode: 'cancelled', content: null, now: now.iso });
      repository.writeArm({ entryId: id, originDate, armedAt: now.iso });
      repository.writeEntry({ ...entry, version: entry.version + 1, updatedAt: now.iso });
      return entryView(principal, insertEntry(principal, content, links, now));
    },

    setException(principal, id, originDate, body) {
      if (!isDate(originDate)) throw invalidInput('/originDate', 'out-of-range');
      const entry = readActiveEntry(principal, id);
      if (!isRepeating(entry)) throw contractError(problems.notFound());
      if (!fitsSeries(entry, originDate)) throw contractError(problems.notFound());
      if (compareDates(originDate, entry.repeat.until) > 0) {
        throw invalidInput('/originDate', 'out-of-range');
      }
      assertVersion(entry, body.expectedVersion);

      const now = parseNow(clock);
      const existing = repository.findException(entry.id, originDate);
      const previousContent = existing?.mode === 'override' && existing.content
        ? existing.content
        : effectiveContent(entry, null, originDate);

      if (body.mode === 'override') {
        const content = normalizeContent(body.content);
        assertContentRules(content, { repeatingTemplate: false });
        const links = resolveCourse(
          principal,
          content.course,
          existing?.content?.courseLinks ?? entry.courseLinks
        );
        assertReminderFuture(content, previousContent, now.ms, { repeatingTemplate: false });
        beforeChange(principal, now.iso);
        repository.writeException({
          entryId: entry.id,
          originDate,
          mode: 'override',
          content: { ...content, calendar: content.calendar ?? previousContent.calendar, courseLinks: links },
          now: now.iso
        });
        if (!sameTime(previousContent.time, content.time) || !sameReminder(previousContent.reminder, content.reminder)) {
          repository.writeArm({ entryId: entry.id, originDate, armedAt: now.iso });
        }
      } else if (body.mode === 'cancelled') {
        beforeChange(principal, now.iso);
        repository.writeException({ entryId: entry.id, originDate, mode: 'cancelled', content: null, now: now.iso });
        repository.writeArm({ entryId: entry.id, originDate, armedAt: now.iso });
      } else {
        beforeChange(principal, now.iso);
        repository.removeException(entry.id, originDate);
        repository.writeArm({ entryId: entry.id, originDate, armedAt: now.iso });
      }

      const updated = { ...entry, version: entry.version + 1, updatedAt: now.iso };
      repository.writeEntry(updated);
      return occurrenceView(principal, occurrenceFor(principal, updated, originDate));
    },

    getOccurrence(principal, id, query) {
      const entry = readEntryOrThrow(principal, id);
      const originDate = query.originDate ?? null;
      if (!isRepeating(entry)) {
        if (originDate !== null) throw invalidInput('/query/originDate', 'out-of-range');
        if (entry.time === null) throw contractError(problems.notFound());
      } else {
        if (originDate === null) throw invalidInput('/query/originDate', 'required');
        if (!isDate(originDate) || !fitsSeries(entry, originDate)) throw contractError(problems.notFound());
      }
      return occurrenceView(principal, occurrenceFor(principal, entry, originDate));
    },

    listOccurrences(principal, query) {
      const settings = readSettings(principal.accountKey);
      const { start, end } = rangeInstants(settings.timeZone, query.from, query.to);
      const items = [];
      for (const entry of repository.listEntries(principal.accountKey)) {
        if (entry.deletedAt || entry.time === null) continue;
        const { byDate } = exceptionMaps(entry);
        if (!isRepeating(entry)) {
          const occurrence = buildOccurrence({
            entry,
            originDate: null,
            exception: null,
            links: entry.courseLinks
          });
          if (intersects(occurrence, start, end)) items.push(occurrence);
          continue;
        }
        const origins = new Set(seriesOriginDates(entry, {
          from: addDays(query.from, -Math.ceil(entry.time.durationMinutes / 1440) - 2), to: addDays(query.to, 2)
        }));
        for (const originDate of byDate.keys()) {
          if (originDate <= entry.repeat.until && fitsSeries(entry, originDate)) origins.add(originDate);
        }
        for (const originDate of origins) {
          const exception = byDate.get(originDate) ?? null;
          const occurrence = buildOccurrence({
            entry,
            originDate,
            exception,
            links: effectiveLinks(entry, exception)
          });
          if (occurrence.state !== 'active') continue;
          if (intersects(occurrence, start, end)) items.push(occurrence);
        }
      }
      sortOccurrences(items);
      return { timeZone: settings.timeZone, items: items.map((item) => occurrenceView(principal, item)) };
    },

    moveItem(principal, body) {
      const from = readActiveEntry(principal, body.fromEntryId);
      if (isRepeating(from)) throw scheduleProblems.invalidMove();
      const itemIndex = from.items.findIndex((item) => item.id === body.itemId);
      if (itemIndex < 0) throw invalidInput('/itemId', 'invalid-reference');
      if (from.version !== body.fromVersion) {
        throw scheduleProblems.versionConflict(from.id, from.version);
      }

      const now = parseNow(clock);
      const item = from.items[itemIndex];

      let target;
      let detached = false;
      let targetOriginDate = null;
      if (body.toEntryId === null) {
        if (body.toScope !== undefined) throw scheduleProblems.invalidMove();
        if (body.toVersion !== null) throw invalidInput('/toVersion', 'out-of-range');
        if (body.toIndex !== 0) throw invalidInput('/toIndex', 'out-of-range');
        target = {
          id: randomUuid(),
          accountKey: principal.accountKey,
          version: 1,
          title: '',
          items: [item],
          time: null,
          repeat: null,
          course: { ...EMPTY_COURSE, recordIds: [] },
          courseLinks: emptyLinks(),
          reminder: null,
          reminderArmedAt: now.iso,
          createdAt: now.iso,
          updatedAt: now.iso,
          deletedAt: null
        };
      } else {
        if (body.toEntryId === body.fromEntryId) throw scheduleProblems.invalidMove();
        const existing = readActiveEntry(principal, body.toEntryId);
        const repeating = isRepeating(existing);
        if ((repeating && !body.toScope) || (!repeating && body.toScope !== undefined)) throw scheduleProblems.invalidMove();
        if (body.toScope === 'series' && body.toOriginDate !== null) throw invalidInput('/toOriginDate', 'out-of-range');
        if (body.toVersion === null) throw invalidInput('/toVersion', 'required');
        if (existing.version !== body.toVersion) {
          throw scheduleProblems.versionConflict(existing.id, existing.version);
        }
        let content = normalizeContent(existing);
        if (body.toScope === 'instance') {
          const origin = body.toOriginDate;
          if (!isDate(origin)) throw invalidInput('/toOriginDate', 'out-of-range');
          if (!fitsSeries(existing, origin)) throw scheduleProblems.invalidMove();
          const occurrence = occurrenceFor(principal, existing, origin);
          if (occurrence.state !== 'active') throw scheduleProblems.invalidMove();
          content = normalizeContent(effectiveContent(existing, repository.findException(existing.id, origin), origin));
        }
        if (content.items.length >= 200) throw invalidInput('/toIndex', 'out-of-range');
        if (content.items.some(candidate => candidate.id === item.id)) throw invalidInput('/itemId', 'duplicate-id');
        if (body.toIndex > content.items.length) throw invalidInput('/toIndex', 'out-of-range');
        const items = [...content.items];
        items.splice(body.toIndex, 0, item);
        if (body.toScope === 'instance') {
          const result = this.detachOccurrence(principal, existing.id, body.toOriginDate, {
            ...content, items, repeat: null, expectedVersion: existing.version
          });
          target = readActiveEntry(principal, result.id);
          detached = true;
        } else {
          target = { ...existing, version: existing.version + 1, items, updatedAt: now.iso };
          assertContentRules(normalizeContent(target), { repeatingTemplate: repeating });
          if (repeating) {
            const dates = seriesOriginDates(target).filter(date => !repository.findException(target.id, date));
            const today = localPartsAt(target.time.timeZone, now.ms).date;
            targetOriginDate = dates.find(date => date >= today) ?? dates[0] ?? null;
          }
        }
      }

      if (!detached) {
        beforeChange(principal, now.iso);
        if (body.toEntryId === null) repository.insertEntry(target);
        else repository.writeEntry(target);
      }

      const remaining = from.items.filter((candidate) => candidate.id !== item.id);
      const keepSource = from.title.trim() !== '' || remaining.length > 0;
      const source = {
        ...from,
        version: from.version + 1,
        items: remaining,
        updatedAt: now.iso,
        deletedAt: keepSource ? from.deletedAt : now.iso
      };
      repository.writeEntry(source);

      return { from: entryView(principal, source), to: entryView(principal, target), ...(body.toScope ? { toOriginDate: targetOriginDate } : {}) };
    },

    /** Public port: `schedule.readOccurrence(principal, {entryId, originDate})`. */
    readOccurrence(principal, { entryId, originDate = null } = {}) {
      const entry = readEntryOrThrow(principal, entryId);
      if (!isRepeating(entry)) {
        if (entry.time === null) throw contractError(problems.notFound());
        if (originDate !== null) throw contractError(problems.notFound());
      } else if (originDate === null || !isDate(originDate) || !fitsSeries(entry, originDate)) {
        throw contractError(problems.notFound());
      }
      return occurrenceView(principal, occurrenceFor(principal, entry, originDate));
    },

    /** Public port: reminder candidates only; never writes a notification. */
    listReminderCandidates(principal, now) {
      const nowMs = now instanceof Date ? now.getTime() : parseInstant(String(now));
      if (Number.isNaN(nowMs)) throw new Error('listReminderCandidates requires a valid server instant.');
      const nowIso = formatIsoZ(nowMs);
      const entries = repository.listEntries(principal.accountKey);
      const exceptionsByEntry = new Map();
      const armsByEntry = new Map();
      for (const entry of entries) {
        exceptionsByEntry.set(entry.id, repository.listExceptions(entry.id));
        armsByEntry.set(entry.id, new Map(repository.listArms(entry.id).map((arm) => [arm.originDate, arm])));
      }
      return listReminderCandidates(entries, exceptionsByEntry, armsByEntry, nowIso);
    }
  };
}
