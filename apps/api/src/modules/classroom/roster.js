import { randomUUID } from 'node:crypto';
import { account, required, active, version, changed, timestamp, listed, conflict } from './records.js';
import { fail } from './schema.js';
export function createRoster({
  repository: r,
  clock
}) {
  const get = (k, p, id) => required(r, k, p, id);
  const save = (k, p, v) => r.write(k, account(p), v);
  const fresh = fields => ({
    id: randomUUID(),
    version: 1,
    createdAt: timestamp(clock),
    updatedAt: timestamp(clock),
    deletedAt: null,
    ...fields
  });
  function checkStudent(p, value, exceptId = null) {
    active(get('classes', p, value.classId));
    if (value.birthday && value.birthday > timestamp(clock).slice(0, 10)) {
      fail('/birthday');
    }
    const students = r.list('students', account(p)).filter(s => !s.deletedAt && s.classId === value.classId && s.id !== exceptId);
    if (students.length >= 1000) {
      fail('/classId');
    }
    if (value.studentNumber !== null && (!value.studentNumber.trim() || students.some(s => s.studentNumber === value.studentNumber))) {
      throw conflict('student-number-conflict');
    }
  }
  function removeSeat(p, student, forceVersion = false) {
    const cls = get('classes', p, student.classId),
      seats = cls.seating.seats.filter(s => s.studentId !== student.id);
    if (forceVersion || seats.length !== cls.seating.seats.length) {
      save('classes', p, changed(cls, clock, {
        seating: {
          ...cls.seating,
          seats
        }
      }));
    }
  }
  function subject(p, record, checkActive = true) {
    const s = get(record.scope === 'class' ? 'classes' : 'students', p, record.subjectId);
    if (checkActive) {
      active(s);
      if (record.scope === 'student') {
        active(get('classes', p, s.classId));
      }
    }
    return s;
  }
  return {
    get(kind, p, id) {
      return get(kind, p, id);
    },
    list(kind, p, q = {}) {
      if (kind === 'students' && q.classId) {
        const cls = get('classes', p, q.classId);
        if (q.deleted !== 'deleted') active(cls);
      }
      if (kind === 'records' && q.subjectId) {
        subject(p, {
          scope: q.scope,
          subjectId: q.subjectId
        }, q.deleted !== 'deleted');
      }
      const values = r.list(kind, account(p)).filter(v => kind !== 'students' || !q.classId || v.classId === q.classId).filter(v => kind !== 'records' || !q.subjectId || v.scope === q.scope && v.subjectId === q.subjectId);
      return listed(values, q, kind === 'records');
    },
    create(kind, p, body) {
      let value;
      if (kind === 'classes') {
        value = fresh({
          name: body.name,
          term: body.term ?? null,
          seating: body.seating ?? {
            rows: 6,
            columns: 8,
            seats: []
          }
        });
        if (value.seating.seats.length) {
          fail('/seating/seats');
        }
      }
      if (kind === 'students') {
        checkStudent(p, body);
        value = fresh(body);
      }
      if (kind === 'records') {
        subject(p, body);
        value = fresh(body);
      }
      return save(kind, p, value);
    },
    update(kind, p, id, body) {
      const old = get(kind, p, id);
      version(old, body.baseVersion);
      active(old);
      const {
        baseVersion,
        ...fields
      } = body;
      if (kind === 'students') {
        checkStudent(p, fields, id);
        active(get('classes', p, old.classId));
        if (old.classId !== fields.classId) {
          removeSeat(p, old, true);
        }
      }
      if (kind === 'records') {
        subject(p, old);
      }
      return save(kind, p, changed(old, clock, fields));
    },
    setSeating(p, id, {
      baseVersion,
      seating
    }) {
      const cls = get('classes', p, id);
      version(cls, baseVersion);
      active(cls);
      const students = new Set(),
        coordinates = new Set();
      seating.seats.forEach((s, i) => {
        const student = active(get('students', p, s.studentId));
        if (student.classId !== id) {
          fail('/seating/seats/' + i + '/studentId');
        }
        const c = s.row + ':' + s.column;
        if (students.has(s.studentId) || coordinates.has(c)) {
          fail('/seating/seats/' + i, 'duplicate-id');
        }
        students.add(s.studentId);
        coordinates.add(c);
      });
      return save('classes', p, changed(cls, clock, {
        seating
      }));
    },
    deletion(kind, p, id, body) {
      const old = get(kind, p, id);
      version(old, body.baseVersion);
      if (!body.deleted && ['students', 'records'].includes(kind)) {
        const student = kind === 'students' ? old : old.scope === 'student' ? get('students', p, old.subjectId) : null;
        const cls = get('classes', p, student ? student.classId : old.subjectId);
        if (cls.deletedAt) {
          throw conflict('restore-class-required');
        }
        if (kind === 'records' && student?.deletedAt) {
          throw conflict('restore-student-required');
        }
        if (kind === 'students') checkStudent(p, old, id);
      }
      if (kind === 'students' && body.deleted) {
        removeSeat(p, old);
      }
      return save(kind, p, changed(old, clock, {
        deletedAt: body.deleted ? timestamp(clock) : null
      }));
    }
  };
}
