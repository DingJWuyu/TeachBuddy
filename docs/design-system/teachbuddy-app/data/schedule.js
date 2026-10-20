var TeachBuddyAdapters;
(TeachBuddyAdapters ||= {}).schedule = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // prototype/current-ui/data/data/schedule.js
  var schedule_exports = {};
  __export(schedule_exports, {
    handleSchedule: () => handleSchedule
  });

  // node_modules/rrule/dist/esm/index.js
  var esm_exports = {};
  __export(esm_exports, {
    ALL_WEEKDAYS: () => ALL_WEEKDAYS,
    Frequency: () => Frequency,
    RRule: () => RRule,
    RRuleSet: () => RRuleSet,
    Weekday: () => Weekday,
    datetime: () => datetime,
    rrulestr: () => rrulestr
  });

  // node_modules/rrule/dist/esm/weekday.js
  var ALL_WEEKDAYS = [
    "MO",
    "TU",
    "WE",
    "TH",
    "FR",
    "SA",
    "SU"
  ];
  var Weekday = (
    /** @class */
    (function() {
      function Weekday2(weekday, n) {
        if (n === 0)
          throw new Error("Can't create weekday with n == 0");
        this.weekday = weekday;
        this.n = n;
      }
      Weekday2.fromStr = function(str) {
        return new Weekday2(ALL_WEEKDAYS.indexOf(str));
      };
      Weekday2.prototype.nth = function(n) {
        return this.n === n ? this : new Weekday2(this.weekday, n);
      };
      Weekday2.prototype.equals = function(other) {
        return this.weekday === other.weekday && this.n === other.n;
      };
      Weekday2.prototype.toString = function() {
        var s = ALL_WEEKDAYS[this.weekday];
        if (this.n)
          s = (this.n > 0 ? "+" : "") + String(this.n) + s;
        return s;
      };
      Weekday2.prototype.getJsWeekday = function() {
        return this.weekday === 6 ? 0 : this.weekday + 1;
      };
      return Weekday2;
    })()
  );

  // node_modules/rrule/dist/esm/helpers.js
  var isPresent = function(value) {
    return value !== null && value !== void 0;
  };
  var isNumber = function(value) {
    return typeof value === "number";
  };
  var isWeekdayStr = function(value) {
    return typeof value === "string" && ALL_WEEKDAYS.includes(value);
  };
  var isArray = Array.isArray;
  var range = function(start, end) {
    if (end === void 0) {
      end = start;
    }
    if (arguments.length === 1) {
      end = start;
      start = 0;
    }
    var rang = [];
    for (var i = start; i < end; i++)
      rang.push(i);
    return rang;
  };
  var repeat = function(value, times) {
    var i = 0;
    var array = [];
    if (isArray(value)) {
      for (; i < times; i++)
        array[i] = [].concat(value);
    } else {
      for (; i < times; i++)
        array[i] = value;
    }
    return array;
  };
  var toArray = function(item) {
    if (isArray(item)) {
      return item;
    }
    return [item];
  };
  function padStart(item, targetLength, padString) {
    if (padString === void 0) {
      padString = " ";
    }
    var str = String(item);
    targetLength = targetLength >> 0;
    if (str.length > targetLength) {
      return String(str);
    }
    targetLength = targetLength - str.length;
    if (targetLength > padString.length) {
      padString += repeat(padString, targetLength / padString.length);
    }
    return padString.slice(0, targetLength) + String(str);
  }
  var split = function(str, sep, num) {
    var splits = str.split(sep);
    return num ? splits.slice(0, num).concat([splits.slice(num).join(sep)]) : splits;
  };
  var pymod = function(a, b) {
    var r = a % b;
    return r * b < 0 ? r + b : r;
  };
  var divmod = function(a, b) {
    return { div: Math.floor(a / b), mod: pymod(a, b) };
  };
  var empty = function(obj) {
    return !isPresent(obj) || obj.length === 0;
  };
  var notEmpty = function(obj) {
    return !empty(obj);
  };
  var includes = function(arr, val) {
    return notEmpty(arr) && arr.indexOf(val) !== -1;
  };

  // node_modules/rrule/dist/esm/dateutil.js
  var datetime = function(y, m, d, h, i, s) {
    if (h === void 0) {
      h = 0;
    }
    if (i === void 0) {
      i = 0;
    }
    if (s === void 0) {
      s = 0;
    }
    return new Date(Date.UTC(y, m - 1, d, h, i, s));
  };
  var MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var ONE_DAY = 1e3 * 60 * 60 * 24;
  var MAXYEAR = 9999;
  var ORDINAL_BASE = datetime(1970, 1, 1);
  var PY_WEEKDAYS = [6, 0, 1, 2, 3, 4, 5];
  var isLeapYear = function(year) {
    return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
  };
  var isDate = function(value) {
    return value instanceof Date;
  };
  var isValidDate = function(value) {
    return isDate(value) && !isNaN(value.getTime());
  };
  var daysBetween = function(date1, date2) {
    var date1ms = date1.getTime();
    var date2ms = date2.getTime();
    var differencems = date1ms - date2ms;
    return Math.round(differencems / ONE_DAY);
  };
  var toOrdinal = function(date2) {
    return daysBetween(date2, ORDINAL_BASE);
  };
  var fromOrdinal = function(ordinal) {
    return new Date(ORDINAL_BASE.getTime() + ordinal * ONE_DAY);
  };
  var getMonthDays = function(date2) {
    var month = date2.getUTCMonth();
    return month === 1 && isLeapYear(date2.getUTCFullYear()) ? 29 : MONTH_DAYS[month];
  };
  var getWeekday = function(date2) {
    return PY_WEEKDAYS[date2.getUTCDay()];
  };
  var monthRange = function(year, month) {
    var date2 = datetime(year, month + 1, 1);
    return [getWeekday(date2), getMonthDays(date2)];
  };
  var combine = function(date2, time) {
    time = time || date2;
    return new Date(Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate(), time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds()));
  };
  var clone = function(date2) {
    var dolly = new Date(date2.getTime());
    return dolly;
  };
  var cloneDates = function(dates) {
    var clones = [];
    for (var i = 0; i < dates.length; i++) {
      clones.push(clone(dates[i]));
    }
    return clones;
  };
  var sort = function(dates) {
    dates.sort(function(a, b) {
      return a.getTime() - b.getTime();
    });
  };
  var timeToUntilString = function(time, utc) {
    if (utc === void 0) {
      utc = true;
    }
    var date2 = new Date(time);
    return [
      padStart(date2.getUTCFullYear().toString(), 4, "0"),
      padStart(date2.getUTCMonth() + 1, 2, "0"),
      padStart(date2.getUTCDate(), 2, "0"),
      "T",
      padStart(date2.getUTCHours(), 2, "0"),
      padStart(date2.getUTCMinutes(), 2, "0"),
      padStart(date2.getUTCSeconds(), 2, "0"),
      utc ? "Z" : ""
    ].join("");
  };
  var untilStringToDate = function(until) {
    var re = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z?)?$/;
    var bits = re.exec(until);
    if (!bits)
      throw new Error("Invalid UNTIL value: ".concat(until));
    return new Date(Date.UTC(parseInt(bits[1], 10), parseInt(bits[2], 10) - 1, parseInt(bits[3], 10), parseInt(bits[5], 10) || 0, parseInt(bits[6], 10) || 0, parseInt(bits[7], 10) || 0));
  };
  var dateTZtoISO8601 = function(date2, timeZone) {
    var dateStr = date2.toLocaleString("sv-SE", { timeZone });
    return dateStr.replace(" ", "T") + "Z";
  };
  var dateInTimeZone = function(date2, timeZone) {
    var localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    var dateInLocalTZ = new Date(dateTZtoISO8601(date2, localTimeZone));
    var dateInTargetTZ = new Date(dateTZtoISO8601(date2, timeZone !== null && timeZone !== void 0 ? timeZone : "UTC"));
    var tzOffset = dateInTargetTZ.getTime() - dateInLocalTZ.getTime();
    return new Date(date2.getTime() - tzOffset);
  };

  // node_modules/rrule/dist/esm/iterresult.js
  var IterResult = (
    /** @class */
    (function() {
      function IterResult2(method, args) {
        this.minDate = null;
        this.maxDate = null;
        this._result = [];
        this.total = 0;
        this.method = method;
        this.args = args;
        if (method === "between") {
          this.maxDate = args.inc ? args.before : new Date(args.before.getTime() - 1);
          this.minDate = args.inc ? args.after : new Date(args.after.getTime() + 1);
        } else if (method === "before") {
          this.maxDate = args.inc ? args.dt : new Date(args.dt.getTime() - 1);
        } else if (method === "after") {
          this.minDate = args.inc ? args.dt : new Date(args.dt.getTime() + 1);
        }
      }
      IterResult2.prototype.accept = function(date2) {
        ++this.total;
        var tooEarly = this.minDate && date2 < this.minDate;
        var tooLate = this.maxDate && date2 > this.maxDate;
        if (this.method === "between") {
          if (tooEarly)
            return true;
          if (tooLate)
            return false;
        } else if (this.method === "before") {
          if (tooLate)
            return false;
        } else if (this.method === "after") {
          if (tooEarly)
            return true;
          this.add(date2);
          return false;
        }
        return this.add(date2);
      };
      IterResult2.prototype.add = function(date2) {
        this._result.push(date2);
        return true;
      };
      IterResult2.prototype.getValue = function() {
        var res = this._result;
        switch (this.method) {
          case "all":
          case "between":
            return res;
          case "before":
          case "after":
          default:
            return res.length ? res[res.length - 1] : null;
        }
      };
      IterResult2.prototype.clone = function() {
        return new IterResult2(this.method, this.args);
      };
      return IterResult2;
    })()
  );
  var iterresult_default = IterResult;

  // node_modules/tslib/tslib.es6.mjs
  var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
    };
    return extendStatics(d, b);
  };
  function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  }
  var __assign = function() {
    __assign = Object.assign || function __assign2(t) {
      for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
      }
      return t;
    };
    return __assign.apply(this, arguments);
  };
  function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  }

  // node_modules/rrule/dist/esm/callbackiterresult.js
  var CallbackIterResult = (
    /** @class */
    (function(_super) {
      __extends(CallbackIterResult2, _super);
      function CallbackIterResult2(method, args, iterator) {
        var _this = _super.call(this, method, args) || this;
        _this.iterator = iterator;
        return _this;
      }
      CallbackIterResult2.prototype.add = function(date2) {
        if (this.iterator(date2, this._result.length)) {
          this._result.push(date2);
          return true;
        }
        return false;
      };
      return CallbackIterResult2;
    })(iterresult_default)
  );
  var callbackiterresult_default = CallbackIterResult;

  // node_modules/rrule/dist/esm/nlp/i18n.js
  var ENGLISH = {
    dayNames: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ],
    monthNames: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ],
    tokens: {
      SKIP: /^[ \r\n\t]+|^\.$/,
      number: /^[1-9][0-9]*/,
      numberAsText: /^(one|two|three)/i,
      every: /^every/i,
      "day(s)": /^days?/i,
      "weekday(s)": /^weekdays?/i,
      "week(s)": /^weeks?/i,
      "hour(s)": /^hours?/i,
      "minute(s)": /^minutes?/i,
      "month(s)": /^months?/i,
      "year(s)": /^years?/i,
      on: /^(on|in)/i,
      at: /^(at)/i,
      the: /^the/i,
      first: /^first/i,
      second: /^second/i,
      third: /^third/i,
      nth: /^([1-9][0-9]*)(\.|th|nd|rd|st)/i,
      last: /^last/i,
      for: /^for/i,
      "time(s)": /^times?/i,
      until: /^(un)?til/i,
      monday: /^mo(n(day)?)?/i,
      tuesday: /^tu(e(s(day)?)?)?/i,
      wednesday: /^we(d(n(esday)?)?)?/i,
      thursday: /^th(u(r(sday)?)?)?/i,
      friday: /^fr(i(day)?)?/i,
      saturday: /^sa(t(urday)?)?/i,
      sunday: /^su(n(day)?)?/i,
      january: /^jan(uary)?/i,
      february: /^feb(ruary)?/i,
      march: /^mar(ch)?/i,
      april: /^apr(il)?/i,
      may: /^may/i,
      june: /^june?/i,
      july: /^july?/i,
      august: /^aug(ust)?/i,
      september: /^sep(t(ember)?)?/i,
      october: /^oct(ober)?/i,
      november: /^nov(ember)?/i,
      december: /^dec(ember)?/i,
      comma: /^(,\s*|(and|or)\s*)+/i
    }
  };
  var i18n_default = ENGLISH;

  // node_modules/rrule/dist/esm/nlp/totext.js
  var contains = function(arr, val) {
    return arr.indexOf(val) !== -1;
  };
  var defaultGetText = function(id2) {
    return id2.toString();
  };
  var defaultDateFormatter = function(year, month, day) {
    return "".concat(month, " ").concat(day, ", ").concat(year);
  };
  var ToText = (
    /** @class */
    (function() {
      function ToText2(rrule, gettext, language, dateFormatter) {
        if (gettext === void 0) {
          gettext = defaultGetText;
        }
        if (language === void 0) {
          language = i18n_default;
        }
        if (dateFormatter === void 0) {
          dateFormatter = defaultDateFormatter;
        }
        this.text = [];
        this.language = language || i18n_default;
        this.gettext = gettext;
        this.dateFormatter = dateFormatter;
        this.rrule = rrule;
        this.options = rrule.options;
        this.origOptions = rrule.origOptions;
        if (this.origOptions.bymonthday) {
          var bymonthday = [].concat(this.options.bymonthday);
          var bynmonthday = [].concat(this.options.bynmonthday);
          bymonthday.sort(function(a, b) {
            return a - b;
          });
          bynmonthday.sort(function(a, b) {
            return b - a;
          });
          this.bymonthday = bymonthday.concat(bynmonthday);
          if (!this.bymonthday.length)
            this.bymonthday = null;
        }
        if (isPresent(this.origOptions.byweekday)) {
          var byweekday = !isArray(this.origOptions.byweekday) ? [this.origOptions.byweekday] : this.origOptions.byweekday;
          var days2 = String(byweekday);
          this.byweekday = {
            allWeeks: byweekday.filter(function(weekday) {
              return !weekday.n;
            }),
            someWeeks: byweekday.filter(function(weekday) {
              return Boolean(weekday.n);
            }),
            isWeekdays: days2.indexOf("MO") !== -1 && days2.indexOf("TU") !== -1 && days2.indexOf("WE") !== -1 && days2.indexOf("TH") !== -1 && days2.indexOf("FR") !== -1 && days2.indexOf("SA") === -1 && days2.indexOf("SU") === -1,
            isEveryDay: days2.indexOf("MO") !== -1 && days2.indexOf("TU") !== -1 && days2.indexOf("WE") !== -1 && days2.indexOf("TH") !== -1 && days2.indexOf("FR") !== -1 && days2.indexOf("SA") !== -1 && days2.indexOf("SU") !== -1
          };
          var sortWeekDays = function(a, b) {
            return a.weekday - b.weekday;
          };
          this.byweekday.allWeeks.sort(sortWeekDays);
          this.byweekday.someWeeks.sort(sortWeekDays);
          if (!this.byweekday.allWeeks.length)
            this.byweekday.allWeeks = null;
          if (!this.byweekday.someWeeks.length)
            this.byweekday.someWeeks = null;
        } else {
          this.byweekday = null;
        }
      }
      ToText2.isFullyConvertible = function(rrule) {
        var canConvert = true;
        if (!(rrule.options.freq in ToText2.IMPLEMENTED))
          return false;
        if (rrule.origOptions.until && rrule.origOptions.count)
          return false;
        for (var key in rrule.origOptions) {
          if (contains(["dtstart", "tzid", "wkst", "freq"], key))
            return true;
          if (!contains(ToText2.IMPLEMENTED[rrule.options.freq], key))
            return false;
        }
        return canConvert;
      };
      ToText2.prototype.isFullyConvertible = function() {
        return ToText2.isFullyConvertible(this.rrule);
      };
      ToText2.prototype.toString = function() {
        var gettext = this.gettext;
        if (!(this.options.freq in ToText2.IMPLEMENTED)) {
          return gettext("RRule error: Unable to fully convert this rrule to text");
        }
        this.text = [gettext("every")];
        this[RRule.FREQUENCIES[this.options.freq]]();
        if (this.options.until) {
          this.add(gettext("until"));
          var until = this.options.until;
          this.add(this.dateFormatter(until.getUTCFullYear(), this.language.monthNames[until.getUTCMonth()], until.getUTCDate()));
        } else if (this.options.count) {
          this.add(gettext("for")).add(this.options.count.toString()).add(this.plural(this.options.count) ? gettext("times") : gettext("time"));
        }
        if (!this.isFullyConvertible())
          this.add(gettext("(~ approximate)"));
        return this.text.join("");
      };
      ToText2.prototype.HOURLY = function() {
        var gettext = this.gettext;
        if (this.options.interval !== 1)
          this.add(this.options.interval.toString());
        this.add(this.plural(this.options.interval) ? gettext("hours") : gettext("hour"));
      };
      ToText2.prototype.MINUTELY = function() {
        var gettext = this.gettext;
        if (this.options.interval !== 1)
          this.add(this.options.interval.toString());
        this.add(this.plural(this.options.interval) ? gettext("minutes") : gettext("minute"));
      };
      ToText2.prototype.DAILY = function() {
        var gettext = this.gettext;
        if (this.options.interval !== 1)
          this.add(this.options.interval.toString());
        if (this.byweekday && this.byweekday.isWeekdays) {
          this.add(this.plural(this.options.interval) ? gettext("weekdays") : gettext("weekday"));
        } else {
          this.add(this.plural(this.options.interval) ? gettext("days") : gettext("day"));
        }
        if (this.origOptions.bymonth) {
          this.add(gettext("in"));
          this._bymonth();
        }
        if (this.bymonthday) {
          this._bymonthday();
        } else if (this.byweekday) {
          this._byweekday();
        } else if (this.origOptions.byhour) {
          this._byhour();
        }
      };
      ToText2.prototype.WEEKLY = function() {
        var gettext = this.gettext;
        if (this.options.interval !== 1) {
          this.add(this.options.interval.toString()).add(this.plural(this.options.interval) ? gettext("weeks") : gettext("week"));
        }
        if (this.byweekday && this.byweekday.isWeekdays) {
          if (this.options.interval === 1) {
            this.add(this.plural(this.options.interval) ? gettext("weekdays") : gettext("weekday"));
          } else {
            this.add(gettext("on")).add(gettext("weekdays"));
          }
        } else if (this.byweekday && this.byweekday.isEveryDay) {
          this.add(this.plural(this.options.interval) ? gettext("days") : gettext("day"));
        } else {
          if (this.options.interval === 1)
            this.add(gettext("week"));
          if (this.origOptions.bymonth) {
            this.add(gettext("in"));
            this._bymonth();
          }
          if (this.bymonthday) {
            this._bymonthday();
          } else if (this.byweekday) {
            this._byweekday();
          }
          if (this.origOptions.byhour) {
            this._byhour();
          }
        }
      };
      ToText2.prototype.MONTHLY = function() {
        var gettext = this.gettext;
        if (this.origOptions.bymonth) {
          if (this.options.interval !== 1) {
            this.add(this.options.interval.toString()).add(gettext("months"));
            if (this.plural(this.options.interval))
              this.add(gettext("in"));
          } else {
          }
          this._bymonth();
        } else {
          if (this.options.interval !== 1) {
            this.add(this.options.interval.toString());
          }
          this.add(this.plural(this.options.interval) ? gettext("months") : gettext("month"));
        }
        if (this.bymonthday) {
          this._bymonthday();
        } else if (this.byweekday && this.byweekday.isWeekdays) {
          this.add(gettext("on")).add(gettext("weekdays"));
        } else if (this.byweekday) {
          this._byweekday();
        }
      };
      ToText2.prototype.YEARLY = function() {
        var gettext = this.gettext;
        if (this.origOptions.bymonth) {
          if (this.options.interval !== 1) {
            this.add(this.options.interval.toString());
            this.add(gettext("years"));
          } else {
          }
          this._bymonth();
        } else {
          if (this.options.interval !== 1) {
            this.add(this.options.interval.toString());
          }
          this.add(this.plural(this.options.interval) ? gettext("years") : gettext("year"));
        }
        if (this.bymonthday) {
          this._bymonthday();
        } else if (this.byweekday) {
          this._byweekday();
        }
        if (this.options.byyearday) {
          this.add(gettext("on the")).add(this.list(this.options.byyearday, this.nth, gettext("and"))).add(gettext("day"));
        }
        if (this.options.byweekno) {
          this.add(gettext("in")).add(this.plural(this.options.byweekno.length) ? gettext("weeks") : gettext("week")).add(this.list(this.options.byweekno, void 0, gettext("and")));
        }
      };
      ToText2.prototype._bymonthday = function() {
        var gettext = this.gettext;
        if (this.byweekday && this.byweekday.allWeeks) {
          this.add(gettext("on")).add(this.list(this.byweekday.allWeeks, this.weekdaytext, gettext("or"))).add(gettext("the")).add(this.list(this.bymonthday, this.nth, gettext("or")));
        } else {
          this.add(gettext("on the")).add(this.list(this.bymonthday, this.nth, gettext("and")));
        }
      };
      ToText2.prototype._byweekday = function() {
        var gettext = this.gettext;
        if (this.byweekday.allWeeks && !this.byweekday.isWeekdays) {
          this.add(gettext("on")).add(this.list(this.byweekday.allWeeks, this.weekdaytext));
        }
        if (this.byweekday.someWeeks) {
          if (this.byweekday.allWeeks)
            this.add(gettext("and"));
          this.add(gettext("on the")).add(this.list(this.byweekday.someWeeks, this.weekdaytext, gettext("and")));
        }
      };
      ToText2.prototype._byhour = function() {
        var gettext = this.gettext;
        this.add(gettext("at")).add(this.list(this.origOptions.byhour, void 0, gettext("and")));
      };
      ToText2.prototype._bymonth = function() {
        this.add(this.list(this.options.bymonth, this.monthtext, this.gettext("and")));
      };
      ToText2.prototype.nth = function(n) {
        n = parseInt(n.toString(), 10);
        var nth;
        var gettext = this.gettext;
        if (n === -1)
          return gettext("last");
        var npos = Math.abs(n);
        switch (npos) {
          case 1:
          case 21:
          case 31:
            nth = npos + gettext("st");
            break;
          case 2:
          case 22:
            nth = npos + gettext("nd");
            break;
          case 3:
          case 23:
            nth = npos + gettext("rd");
            break;
          default:
            nth = npos + gettext("th");
        }
        return n < 0 ? nth + " " + gettext("last") : nth;
      };
      ToText2.prototype.monthtext = function(m) {
        return this.language.monthNames[m - 1];
      };
      ToText2.prototype.weekdaytext = function(wday) {
        var weekday = isNumber(wday) ? (wday + 1) % 7 : wday.getJsWeekday();
        return (wday.n ? this.nth(wday.n) + " " : "") + this.language.dayNames[weekday];
      };
      ToText2.prototype.plural = function(n) {
        return n % 100 !== 1;
      };
      ToText2.prototype.add = function(s) {
        this.text.push(" ");
        this.text.push(s);
        return this;
      };
      ToText2.prototype.list = function(arr, callback, finalDelim, delim) {
        var _this = this;
        if (delim === void 0) {
          delim = ",";
        }
        if (!isArray(arr)) {
          arr = [arr];
        }
        var delimJoin = function(array, delimiter, finalDelimiter) {
          var list = "";
          for (var i = 0; i < array.length; i++) {
            if (i !== 0) {
              if (i === array.length - 1) {
                list += " " + finalDelimiter + " ";
              } else {
                list += delimiter + " ";
              }
            }
            list += array[i];
          }
          return list;
        };
        callback = callback || function(o) {
          return o.toString();
        };
        var realCallback = function(arg) {
          return callback && callback.call(_this, arg);
        };
        if (finalDelim) {
          return delimJoin(arr.map(realCallback), delim, finalDelim);
        } else {
          return arr.map(realCallback).join(delim + " ");
        }
      };
      return ToText2;
    })()
  );
  var totext_default = ToText;

  // node_modules/rrule/dist/esm/nlp/parsetext.js
  var Parser = (
    /** @class */
    (function() {
      function Parser2(rules) {
        this.done = true;
        this.rules = rules;
      }
      Parser2.prototype.start = function(text) {
        this.text = text;
        this.done = false;
        return this.nextSymbol();
      };
      Parser2.prototype.isDone = function() {
        return this.done && this.symbol === null;
      };
      Parser2.prototype.nextSymbol = function() {
        var best;
        var bestSymbol;
        this.symbol = null;
        this.value = null;
        do {
          if (this.done)
            return false;
          var rule = void 0;
          best = null;
          for (var name_1 in this.rules) {
            rule = this.rules[name_1];
            var match = rule.exec(this.text);
            if (match) {
              if (best === null || match[0].length > best[0].length) {
                best = match;
                bestSymbol = name_1;
              }
            }
          }
          if (best != null) {
            this.text = this.text.substr(best[0].length);
            if (this.text === "")
              this.done = true;
          }
          if (best == null) {
            this.done = true;
            this.symbol = null;
            this.value = null;
            return;
          }
        } while (bestSymbol === "SKIP");
        this.symbol = bestSymbol;
        this.value = best;
        return true;
      };
      Parser2.prototype.accept = function(name) {
        if (this.symbol === name) {
          if (this.value) {
            var v = this.value;
            this.nextSymbol();
            return v;
          }
          this.nextSymbol();
          return true;
        }
        return false;
      };
      Parser2.prototype.acceptNumber = function() {
        return this.accept("number");
      };
      Parser2.prototype.expect = function(name) {
        if (this.accept(name))
          return true;
        throw new Error("expected " + name + " but found " + this.symbol);
      };
      return Parser2;
    })()
  );
  function parseText(text, language) {
    if (language === void 0) {
      language = i18n_default;
    }
    var options = {};
    var ttr = new Parser(language.tokens);
    if (!ttr.start(text))
      return null;
    S();
    return options;
    function S() {
      ttr.expect("every");
      var n = ttr.acceptNumber();
      if (n)
        options.interval = parseInt(n[0], 10);
      if (ttr.isDone())
        throw new Error("Unexpected end");
      switch (ttr.symbol) {
        case "day(s)":
          options.freq = RRule.DAILY;
          if (ttr.nextSymbol()) {
            AT();
            F();
          }
          break;
        // FIXME Note: every 2 weekdays != every two weeks on weekdays.
        // DAILY on weekdays is not a valid rule
        case "weekday(s)":
          options.freq = RRule.WEEKLY;
          options.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
          ttr.nextSymbol();
          AT();
          F();
          break;
        case "week(s)":
          options.freq = RRule.WEEKLY;
          if (ttr.nextSymbol()) {
            ON();
            AT();
            F();
          }
          break;
        case "hour(s)":
          options.freq = RRule.HOURLY;
          if (ttr.nextSymbol()) {
            ON();
            F();
          }
          break;
        case "minute(s)":
          options.freq = RRule.MINUTELY;
          if (ttr.nextSymbol()) {
            ON();
            F();
          }
          break;
        case "month(s)":
          options.freq = RRule.MONTHLY;
          if (ttr.nextSymbol()) {
            ON();
            F();
          }
          break;
        case "year(s)":
          options.freq = RRule.YEARLY;
          if (ttr.nextSymbol()) {
            ON();
            F();
          }
          break;
        case "monday":
        case "tuesday":
        case "wednesday":
        case "thursday":
        case "friday":
        case "saturday":
        case "sunday":
          options.freq = RRule.WEEKLY;
          var key = ttr.symbol.substr(0, 2).toUpperCase();
          options.byweekday = [RRule[key]];
          if (!ttr.nextSymbol())
            return;
          while (ttr.accept("comma")) {
            if (ttr.isDone())
              throw new Error("Unexpected end");
            var wkd = decodeWKD();
            if (!wkd) {
              throw new Error("Unexpected symbol " + ttr.symbol + ", expected weekday");
            }
            options.byweekday.push(RRule[wkd]);
            ttr.nextSymbol();
          }
          AT();
          MDAYs();
          F();
          break;
        case "january":
        case "february":
        case "march":
        case "april":
        case "may":
        case "june":
        case "july":
        case "august":
        case "september":
        case "october":
        case "november":
        case "december":
          options.freq = RRule.YEARLY;
          options.bymonth = [decodeM()];
          if (!ttr.nextSymbol())
            return;
          while (ttr.accept("comma")) {
            if (ttr.isDone())
              throw new Error("Unexpected end");
            var m = decodeM();
            if (!m) {
              throw new Error("Unexpected symbol " + ttr.symbol + ", expected month");
            }
            options.bymonth.push(m);
            ttr.nextSymbol();
          }
          ON();
          F();
          break;
        default:
          throw new Error("Unknown symbol");
      }
    }
    function ON() {
      var on = ttr.accept("on");
      var the = ttr.accept("the");
      if (!(on || the))
        return;
      do {
        var nth = decodeNTH();
        var wkd = decodeWKD();
        var m = decodeM();
        if (nth) {
          if (wkd) {
            ttr.nextSymbol();
            if (!options.byweekday)
              options.byweekday = [];
            options.byweekday.push(RRule[wkd].nth(nth));
          } else {
            if (!options.bymonthday)
              options.bymonthday = [];
            options.bymonthday.push(nth);
            ttr.accept("day(s)");
          }
        } else if (wkd) {
          ttr.nextSymbol();
          if (!options.byweekday)
            options.byweekday = [];
          options.byweekday.push(RRule[wkd]);
        } else if (ttr.symbol === "weekday(s)") {
          ttr.nextSymbol();
          if (!options.byweekday) {
            options.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
          }
        } else if (ttr.symbol === "week(s)") {
          ttr.nextSymbol();
          var n = ttr.acceptNumber();
          if (!n) {
            throw new Error("Unexpected symbol " + ttr.symbol + ", expected week number");
          }
          options.byweekno = [parseInt(n[0], 10)];
          while (ttr.accept("comma")) {
            n = ttr.acceptNumber();
            if (!n) {
              throw new Error("Unexpected symbol " + ttr.symbol + "; expected monthday");
            }
            options.byweekno.push(parseInt(n[0], 10));
          }
        } else if (m) {
          ttr.nextSymbol();
          if (!options.bymonth)
            options.bymonth = [];
          options.bymonth.push(m);
        } else {
          return;
        }
      } while (ttr.accept("comma") || ttr.accept("the") || ttr.accept("on"));
    }
    function AT() {
      var at = ttr.accept("at");
      if (!at)
        return;
      do {
        var n = ttr.acceptNumber();
        if (!n) {
          throw new Error("Unexpected symbol " + ttr.symbol + ", expected hour");
        }
        options.byhour = [parseInt(n[0], 10)];
        while (ttr.accept("comma")) {
          n = ttr.acceptNumber();
          if (!n) {
            throw new Error("Unexpected symbol " + ttr.symbol + "; expected hour");
          }
          options.byhour.push(parseInt(n[0], 10));
        }
      } while (ttr.accept("comma") || ttr.accept("at"));
    }
    function decodeM() {
      switch (ttr.symbol) {
        case "january":
          return 1;
        case "february":
          return 2;
        case "march":
          return 3;
        case "april":
          return 4;
        case "may":
          return 5;
        case "june":
          return 6;
        case "july":
          return 7;
        case "august":
          return 8;
        case "september":
          return 9;
        case "october":
          return 10;
        case "november":
          return 11;
        case "december":
          return 12;
        default:
          return false;
      }
    }
    function decodeWKD() {
      switch (ttr.symbol) {
        case "monday":
        case "tuesday":
        case "wednesday":
        case "thursday":
        case "friday":
        case "saturday":
        case "sunday":
          return ttr.symbol.substr(0, 2).toUpperCase();
        default:
          return false;
      }
    }
    function decodeNTH() {
      switch (ttr.symbol) {
        case "last":
          ttr.nextSymbol();
          return -1;
        case "first":
          ttr.nextSymbol();
          return 1;
        case "second":
          ttr.nextSymbol();
          return ttr.accept("last") ? -2 : 2;
        case "third":
          ttr.nextSymbol();
          return ttr.accept("last") ? -3 : 3;
        case "nth":
          var v = parseInt(ttr.value[1], 10);
          if (v < -366 || v > 366)
            throw new Error("Nth out of range: " + v);
          ttr.nextSymbol();
          return ttr.accept("last") ? -v : v;
        default:
          return false;
      }
    }
    function MDAYs() {
      ttr.accept("on");
      ttr.accept("the");
      var nth = decodeNTH();
      if (!nth)
        return;
      options.bymonthday = [nth];
      ttr.nextSymbol();
      while (ttr.accept("comma")) {
        nth = decodeNTH();
        if (!nth) {
          throw new Error("Unexpected symbol " + ttr.symbol + "; expected monthday");
        }
        options.bymonthday.push(nth);
        ttr.nextSymbol();
      }
    }
    function F() {
      if (ttr.symbol === "until") {
        var date2 = Date.parse(ttr.text);
        if (!date2)
          throw new Error("Cannot parse until date:" + ttr.text);
        options.until = new Date(date2);
      } else if (ttr.accept("for")) {
        options.count = parseInt(ttr.value[0], 10);
        ttr.expect("number");
      }
    }
  }

  // node_modules/rrule/dist/esm/types.js
  var Frequency;
  (function(Frequency2) {
    Frequency2[Frequency2["YEARLY"] = 0] = "YEARLY";
    Frequency2[Frequency2["MONTHLY"] = 1] = "MONTHLY";
    Frequency2[Frequency2["WEEKLY"] = 2] = "WEEKLY";
    Frequency2[Frequency2["DAILY"] = 3] = "DAILY";
    Frequency2[Frequency2["HOURLY"] = 4] = "HOURLY";
    Frequency2[Frequency2["MINUTELY"] = 5] = "MINUTELY";
    Frequency2[Frequency2["SECONDLY"] = 6] = "SECONDLY";
  })(Frequency || (Frequency = {}));
  function freqIsDailyOrGreater(freq) {
    return freq < Frequency.HOURLY;
  }

  // node_modules/rrule/dist/esm/nlp/index.js
  var fromText = function(text, language) {
    if (language === void 0) {
      language = i18n_default;
    }
    return new RRule(parseText(text, language) || void 0);
  };
  var common = [
    "count",
    "until",
    "interval",
    "byweekday",
    "bymonthday",
    "bymonth"
  ];
  totext_default.IMPLEMENTED = [];
  totext_default.IMPLEMENTED[Frequency.HOURLY] = common;
  totext_default.IMPLEMENTED[Frequency.MINUTELY] = common;
  totext_default.IMPLEMENTED[Frequency.DAILY] = ["byhour"].concat(common);
  totext_default.IMPLEMENTED[Frequency.WEEKLY] = common;
  totext_default.IMPLEMENTED[Frequency.MONTHLY] = common;
  totext_default.IMPLEMENTED[Frequency.YEARLY] = ["byweekno", "byyearday"].concat(common);
  var toText = function(rrule, gettext, language, dateFormatter) {
    return new totext_default(rrule, gettext, language, dateFormatter).toString();
  };
  var isFullyConvertible = totext_default.isFullyConvertible;

  // node_modules/rrule/dist/esm/datetime.js
  var Time = (
    /** @class */
    (function() {
      function Time2(hour, minute, second, millisecond) {
        this.hour = hour;
        this.minute = minute;
        this.second = second;
        this.millisecond = millisecond || 0;
      }
      Time2.prototype.getHours = function() {
        return this.hour;
      };
      Time2.prototype.getMinutes = function() {
        return this.minute;
      };
      Time2.prototype.getSeconds = function() {
        return this.second;
      };
      Time2.prototype.getMilliseconds = function() {
        return this.millisecond;
      };
      Time2.prototype.getTime = function() {
        return (this.hour * 60 * 60 + this.minute * 60 + this.second) * 1e3 + this.millisecond;
      };
      return Time2;
    })()
  );
  var DateTime = (
    /** @class */
    (function(_super) {
      __extends(DateTime2, _super);
      function DateTime2(year, month, day, hour, minute, second, millisecond) {
        var _this = _super.call(this, hour, minute, second, millisecond) || this;
        _this.year = year;
        _this.month = month;
        _this.day = day;
        return _this;
      }
      DateTime2.fromDate = function(date2) {
        return new this(date2.getUTCFullYear(), date2.getUTCMonth() + 1, date2.getUTCDate(), date2.getUTCHours(), date2.getUTCMinutes(), date2.getUTCSeconds(), date2.valueOf() % 1e3);
      };
      DateTime2.prototype.getWeekday = function() {
        return getWeekday(new Date(this.getTime()));
      };
      DateTime2.prototype.getTime = function() {
        return new Date(Date.UTC(this.year, this.month - 1, this.day, this.hour, this.minute, this.second, this.millisecond)).getTime();
      };
      DateTime2.prototype.getDay = function() {
        return this.day;
      };
      DateTime2.prototype.getMonth = function() {
        return this.month;
      };
      DateTime2.prototype.getYear = function() {
        return this.year;
      };
      DateTime2.prototype.addYears = function(years) {
        this.year += years;
      };
      DateTime2.prototype.addMonths = function(months) {
        this.month += months;
        if (this.month > 12) {
          var yearDiv = Math.floor(this.month / 12);
          var monthMod = pymod(this.month, 12);
          this.month = monthMod;
          this.year += yearDiv;
          if (this.month === 0) {
            this.month = 12;
            --this.year;
          }
        }
      };
      DateTime2.prototype.addWeekly = function(days2, wkst) {
        if (wkst > this.getWeekday()) {
          this.day += -(this.getWeekday() + 1 + (6 - wkst)) + days2 * 7;
        } else {
          this.day += -(this.getWeekday() - wkst) + days2 * 7;
        }
        this.fixDay();
      };
      DateTime2.prototype.addDaily = function(days2) {
        this.day += days2;
        this.fixDay();
      };
      DateTime2.prototype.addHours = function(hours, filtered, byhour) {
        if (filtered) {
          this.hour += Math.floor((23 - this.hour) / hours) * hours;
        }
        for (; ; ) {
          this.hour += hours;
          var _a = divmod(this.hour, 24), dayDiv = _a.div, hourMod = _a.mod;
          if (dayDiv) {
            this.hour = hourMod;
            this.addDaily(dayDiv);
          }
          if (empty(byhour) || includes(byhour, this.hour))
            break;
        }
      };
      DateTime2.prototype.addMinutes = function(minutes, filtered, byhour, byminute) {
        if (filtered) {
          this.minute += Math.floor((1439 - (this.hour * 60 + this.minute)) / minutes) * minutes;
        }
        for (; ; ) {
          this.minute += minutes;
          var _a = divmod(this.minute, 60), hourDiv = _a.div, minuteMod = _a.mod;
          if (hourDiv) {
            this.minute = minuteMod;
            this.addHours(hourDiv, false, byhour);
          }
          if ((empty(byhour) || includes(byhour, this.hour)) && (empty(byminute) || includes(byminute, this.minute))) {
            break;
          }
        }
      };
      DateTime2.prototype.addSeconds = function(seconds, filtered, byhour, byminute, bysecond) {
        if (filtered) {
          this.second += Math.floor((86399 - (this.hour * 3600 + this.minute * 60 + this.second)) / seconds) * seconds;
        }
        for (; ; ) {
          this.second += seconds;
          var _a = divmod(this.second, 60), minuteDiv = _a.div, secondMod = _a.mod;
          if (minuteDiv) {
            this.second = secondMod;
            this.addMinutes(minuteDiv, false, byhour, byminute);
          }
          if ((empty(byhour) || includes(byhour, this.hour)) && (empty(byminute) || includes(byminute, this.minute)) && (empty(bysecond) || includes(bysecond, this.second))) {
            break;
          }
        }
      };
      DateTime2.prototype.fixDay = function() {
        if (this.day <= 28) {
          return;
        }
        var daysinmonth = monthRange(this.year, this.month - 1)[1];
        if (this.day <= daysinmonth) {
          return;
        }
        while (this.day > daysinmonth) {
          this.day -= daysinmonth;
          ++this.month;
          if (this.month === 13) {
            this.month = 1;
            ++this.year;
            if (this.year > MAXYEAR) {
              return;
            }
          }
          daysinmonth = monthRange(this.year, this.month - 1)[1];
        }
      };
      DateTime2.prototype.add = function(options, filtered) {
        var freq = options.freq, interval = options.interval, wkst = options.wkst, byhour = options.byhour, byminute = options.byminute, bysecond = options.bysecond;
        switch (freq) {
          case Frequency.YEARLY:
            return this.addYears(interval);
          case Frequency.MONTHLY:
            return this.addMonths(interval);
          case Frequency.WEEKLY:
            return this.addWeekly(interval, wkst);
          case Frequency.DAILY:
            return this.addDaily(interval);
          case Frequency.HOURLY:
            return this.addHours(interval, filtered, byhour);
          case Frequency.MINUTELY:
            return this.addMinutes(interval, filtered, byhour, byminute);
          case Frequency.SECONDLY:
            return this.addSeconds(interval, filtered, byhour, byminute, bysecond);
        }
      };
      return DateTime2;
    })(Time)
  );

  // node_modules/rrule/dist/esm/parseoptions.js
  function initializeOptions(options) {
    var invalid = [];
    var keys = Object.keys(options);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
      var key = keys_1[_i];
      if (!includes(defaultKeys, key))
        invalid.push(key);
      if (isDate(options[key]) && !isValidDate(options[key])) {
        invalid.push(key);
      }
    }
    if (invalid.length) {
      throw new Error("Invalid options: " + invalid.join(", "));
    }
    return __assign({}, options);
  }
  function parseOptions(options) {
    var opts = __assign(__assign({}, DEFAULT_OPTIONS), initializeOptions(options));
    if (isPresent(opts.byeaster))
      opts.freq = RRule.YEARLY;
    if (!(isPresent(opts.freq) && RRule.FREQUENCIES[opts.freq])) {
      throw new Error("Invalid frequency: ".concat(opts.freq, " ").concat(options.freq));
    }
    if (!opts.dtstart)
      opts.dtstart = new Date((/* @__PURE__ */ new Date()).setMilliseconds(0));
    if (!isPresent(opts.wkst)) {
      opts.wkst = RRule.MO.weekday;
    } else if (isNumber(opts.wkst)) {
    } else {
      opts.wkst = opts.wkst.weekday;
    }
    if (isPresent(opts.bysetpos)) {
      if (isNumber(opts.bysetpos))
        opts.bysetpos = [opts.bysetpos];
      for (var i = 0; i < opts.bysetpos.length; i++) {
        var v = opts.bysetpos[i];
        if (v === 0 || !(v >= -366 && v <= 366)) {
          throw new Error("bysetpos must be between 1 and 366, or between -366 and -1");
        }
      }
    }
    if (!(Boolean(opts.byweekno) || notEmpty(opts.byweekno) || notEmpty(opts.byyearday) || Boolean(opts.bymonthday) || notEmpty(opts.bymonthday) || isPresent(opts.byweekday) || isPresent(opts.byeaster))) {
      switch (opts.freq) {
        case RRule.YEARLY:
          if (!opts.bymonth)
            opts.bymonth = opts.dtstart.getUTCMonth() + 1;
          opts.bymonthday = opts.dtstart.getUTCDate();
          break;
        case RRule.MONTHLY:
          opts.bymonthday = opts.dtstart.getUTCDate();
          break;
        case RRule.WEEKLY:
          opts.byweekday = [getWeekday(opts.dtstart)];
          break;
      }
    }
    if (isPresent(opts.bymonth) && !isArray(opts.bymonth)) {
      opts.bymonth = [opts.bymonth];
    }
    if (isPresent(opts.byyearday) && !isArray(opts.byyearday) && isNumber(opts.byyearday)) {
      opts.byyearday = [opts.byyearday];
    }
    if (!isPresent(opts.bymonthday)) {
      opts.bymonthday = [];
      opts.bynmonthday = [];
    } else if (isArray(opts.bymonthday)) {
      var bymonthday = [];
      var bynmonthday = [];
      for (var i = 0; i < opts.bymonthday.length; i++) {
        var v = opts.bymonthday[i];
        if (v > 0) {
          bymonthday.push(v);
        } else if (v < 0) {
          bynmonthday.push(v);
        }
      }
      opts.bymonthday = bymonthday;
      opts.bynmonthday = bynmonthday;
    } else if (opts.bymonthday < 0) {
      opts.bynmonthday = [opts.bymonthday];
      opts.bymonthday = [];
    } else {
      opts.bynmonthday = [];
      opts.bymonthday = [opts.bymonthday];
    }
    if (isPresent(opts.byweekno) && !isArray(opts.byweekno)) {
      opts.byweekno = [opts.byweekno];
    }
    if (!isPresent(opts.byweekday)) {
      opts.bynweekday = null;
    } else if (isNumber(opts.byweekday)) {
      opts.byweekday = [opts.byweekday];
      opts.bynweekday = null;
    } else if (isWeekdayStr(opts.byweekday)) {
      opts.byweekday = [Weekday.fromStr(opts.byweekday).weekday];
      opts.bynweekday = null;
    } else if (opts.byweekday instanceof Weekday) {
      if (!opts.byweekday.n || opts.freq > RRule.MONTHLY) {
        opts.byweekday = [opts.byweekday.weekday];
        opts.bynweekday = null;
      } else {
        opts.bynweekday = [[opts.byweekday.weekday, opts.byweekday.n]];
        opts.byweekday = null;
      }
    } else {
      var byweekday = [];
      var bynweekday = [];
      for (var i = 0; i < opts.byweekday.length; i++) {
        var wday = opts.byweekday[i];
        if (isNumber(wday)) {
          byweekday.push(wday);
          continue;
        } else if (isWeekdayStr(wday)) {
          byweekday.push(Weekday.fromStr(wday).weekday);
          continue;
        }
        if (!wday.n || opts.freq > RRule.MONTHLY) {
          byweekday.push(wday.weekday);
        } else {
          bynweekday.push([wday.weekday, wday.n]);
        }
      }
      opts.byweekday = notEmpty(byweekday) ? byweekday : null;
      opts.bynweekday = notEmpty(bynweekday) ? bynweekday : null;
    }
    if (!isPresent(opts.byhour)) {
      opts.byhour = opts.freq < RRule.HOURLY ? [opts.dtstart.getUTCHours()] : null;
    } else if (isNumber(opts.byhour)) {
      opts.byhour = [opts.byhour];
    }
    if (!isPresent(opts.byminute)) {
      opts.byminute = opts.freq < RRule.MINUTELY ? [opts.dtstart.getUTCMinutes()] : null;
    } else if (isNumber(opts.byminute)) {
      opts.byminute = [opts.byminute];
    }
    if (!isPresent(opts.bysecond)) {
      opts.bysecond = opts.freq < RRule.SECONDLY ? [opts.dtstart.getUTCSeconds()] : null;
    } else if (isNumber(opts.bysecond)) {
      opts.bysecond = [opts.bysecond];
    }
    return { parsedOptions: opts };
  }
  function buildTimeset(opts) {
    var millisecondModulo = opts.dtstart.getTime() % 1e3;
    if (!freqIsDailyOrGreater(opts.freq)) {
      return [];
    }
    var timeset = [];
    opts.byhour.forEach(function(hour) {
      opts.byminute.forEach(function(minute) {
        opts.bysecond.forEach(function(second) {
          timeset.push(new Time(hour, minute, second, millisecondModulo));
        });
      });
    });
    return timeset;
  }

  // node_modules/rrule/dist/esm/parsestring.js
  function parseString(rfcString) {
    var options = rfcString.split("\n").map(parseLine).filter(function(x) {
      return x !== null;
    });
    return __assign(__assign({}, options[0]), options[1]);
  }
  function parseDtstart(line) {
    var options = {};
    var dtstartWithZone = /DTSTART(?:;TZID=([^:=]+?))?(?::|=)([^;\s]+)/i.exec(line);
    if (!dtstartWithZone) {
      return options;
    }
    var tzid = dtstartWithZone[1], dtstart = dtstartWithZone[2];
    if (tzid) {
      options.tzid = tzid;
    }
    options.dtstart = untilStringToDate(dtstart);
    return options;
  }
  function parseLine(rfcString) {
    rfcString = rfcString.replace(/^\s+|\s+$/, "");
    if (!rfcString.length)
      return null;
    var header = /^([A-Z]+?)[:;]/.exec(rfcString.toUpperCase());
    if (!header) {
      return parseRrule(rfcString);
    }
    var key = header[1];
    switch (key.toUpperCase()) {
      case "RRULE":
      case "EXRULE":
        return parseRrule(rfcString);
      case "DTSTART":
        return parseDtstart(rfcString);
      default:
        throw new Error("Unsupported RFC prop ".concat(key, " in ").concat(rfcString));
    }
  }
  function parseRrule(line) {
    var strippedLine = line.replace(/^RRULE:/i, "");
    var options = parseDtstart(strippedLine);
    var attrs = line.replace(/^(?:RRULE|EXRULE):/i, "").split(";");
    attrs.forEach(function(attr) {
      var _a = attr.split("="), key = _a[0], value = _a[1];
      switch (key.toUpperCase()) {
        case "FREQ":
          options.freq = Frequency[value.toUpperCase()];
          break;
        case "WKST":
          options.wkst = Days[value.toUpperCase()];
          break;
        case "COUNT":
        case "INTERVAL":
        case "BYSETPOS":
        case "BYMONTH":
        case "BYMONTHDAY":
        case "BYYEARDAY":
        case "BYWEEKNO":
        case "BYHOUR":
        case "BYMINUTE":
        case "BYSECOND":
          var num = parseNumber(value);
          var optionKey = key.toLowerCase();
          options[optionKey] = num;
          break;
        case "BYWEEKDAY":
        case "BYDAY":
          options.byweekday = parseWeekday(value);
          break;
        case "DTSTART":
        case "TZID":
          var dtstart = parseDtstart(line);
          options.tzid = dtstart.tzid;
          options.dtstart = dtstart.dtstart;
          break;
        case "UNTIL":
          options.until = untilStringToDate(value);
          break;
        case "BYEASTER":
          options.byeaster = Number(value);
          break;
        default:
          throw new Error("Unknown RRULE property '" + key + "'");
      }
    });
    return options;
  }
  function parseNumber(value) {
    if (value.indexOf(",") !== -1) {
      var values = value.split(",");
      return values.map(parseIndividualNumber);
    }
    return parseIndividualNumber(value);
  }
  function parseIndividualNumber(value) {
    if (/^[+-]?\d+$/.test(value)) {
      return Number(value);
    }
    return value;
  }
  function parseWeekday(value) {
    var days2 = value.split(",");
    return days2.map(function(day) {
      if (day.length === 2) {
        return Days[day];
      }
      var parts = day.match(/^([+-]?\d{1,2})([A-Z]{2})$/);
      if (!parts || parts.length < 3) {
        throw new SyntaxError("Invalid weekday string: ".concat(day));
      }
      var n = Number(parts[1]);
      var wdaypart = parts[2];
      var wday = Days[wdaypart].weekday;
      return new Weekday(wday, n);
    });
  }

  // node_modules/rrule/dist/esm/datewithzone.js
  var DateWithZone = (
    /** @class */
    (function() {
      function DateWithZone2(date2, tzid) {
        if (isNaN(date2.getTime())) {
          throw new RangeError("Invalid date passed to DateWithZone");
        }
        this.date = date2;
        this.tzid = tzid;
      }
      Object.defineProperty(DateWithZone2.prototype, "isUTC", {
        get: function() {
          return !this.tzid || this.tzid.toUpperCase() === "UTC";
        },
        enumerable: false,
        configurable: true
      });
      DateWithZone2.prototype.toString = function() {
        var datestr = timeToUntilString(this.date.getTime(), this.isUTC);
        if (!this.isUTC) {
          return ";TZID=".concat(this.tzid, ":").concat(datestr);
        }
        return ":".concat(datestr);
      };
      DateWithZone2.prototype.getTime = function() {
        return this.date.getTime();
      };
      DateWithZone2.prototype.rezonedDate = function() {
        if (this.isUTC) {
          return this.date;
        }
        return dateInTimeZone(this.date, this.tzid);
      };
      return DateWithZone2;
    })()
  );

  // node_modules/rrule/dist/esm/optionstostring.js
  function optionsToString(options) {
    var rrule = [];
    var dtstart = "";
    var keys = Object.keys(options);
    var defaultKeys2 = Object.keys(DEFAULT_OPTIONS);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] === "tzid")
        continue;
      if (!includes(defaultKeys2, keys[i]))
        continue;
      var key = keys[i].toUpperCase();
      var value = options[keys[i]];
      var outValue = "";
      if (!isPresent(value) || isArray(value) && !value.length)
        continue;
      switch (key) {
        case "FREQ":
          outValue = RRule.FREQUENCIES[options.freq];
          break;
        case "WKST":
          if (isNumber(value)) {
            outValue = new Weekday(value).toString();
          } else {
            outValue = value.toString();
          }
          break;
        case "BYWEEKDAY":
          key = "BYDAY";
          outValue = toArray(value).map(function(wday) {
            if (wday instanceof Weekday) {
              return wday;
            }
            if (isArray(wday)) {
              return new Weekday(wday[0], wday[1]);
            }
            return new Weekday(wday);
          }).toString();
          break;
        case "DTSTART":
          dtstart = buildDtstart(value, options.tzid);
          break;
        case "UNTIL":
          outValue = timeToUntilString(value, !options.tzid);
          break;
        default:
          if (isArray(value)) {
            var strValues = [];
            for (var j = 0; j < value.length; j++) {
              strValues[j] = String(value[j]);
            }
            outValue = strValues.toString();
          } else {
            outValue = String(value);
          }
      }
      if (outValue) {
        rrule.push([key, outValue]);
      }
    }
    var rules = rrule.map(function(_a) {
      var key2 = _a[0], value2 = _a[1];
      return "".concat(key2, "=").concat(value2.toString());
    }).join(";");
    var ruleString = "";
    if (rules !== "") {
      ruleString = "RRULE:".concat(rules);
    }
    return [dtstart, ruleString].filter(function(x) {
      return !!x;
    }).join("\n");
  }
  function buildDtstart(dtstart, tzid) {
    if (!dtstart) {
      return "";
    }
    return "DTSTART" + new DateWithZone(new Date(dtstart), tzid).toString();
  }

  // node_modules/rrule/dist/esm/cache.js
  function argsMatch(left, right) {
    if (Array.isArray(left)) {
      if (!Array.isArray(right))
        return false;
      if (left.length !== right.length)
        return false;
      return left.every(function(date2, i) {
        return date2.getTime() === right[i].getTime();
      });
    }
    if (left instanceof Date) {
      return right instanceof Date && left.getTime() === right.getTime();
    }
    return left === right;
  }
  var Cache = (
    /** @class */
    (function() {
      function Cache2() {
        this.all = false;
        this.before = [];
        this.after = [];
        this.between = [];
      }
      Cache2.prototype._cacheAdd = function(what, value, args) {
        if (value) {
          value = value instanceof Date ? clone(value) : cloneDates(value);
        }
        if (what === "all") {
          this.all = value;
        } else {
          args._value = value;
          this[what].push(args);
        }
      };
      Cache2.prototype._cacheGet = function(what, args) {
        var cached = false;
        var argsKeys = args ? Object.keys(args) : [];
        var findCacheDiff = function(item2) {
          for (var i2 = 0; i2 < argsKeys.length; i2++) {
            var key = argsKeys[i2];
            if (!argsMatch(args[key], item2[key])) {
              return true;
            }
          }
          return false;
        };
        var cachedObject = this[what];
        if (what === "all") {
          cached = this.all;
        } else if (isArray(cachedObject)) {
          for (var i = 0; i < cachedObject.length; i++) {
            var item = cachedObject[i];
            if (argsKeys.length && findCacheDiff(item))
              continue;
            cached = item._value;
            break;
          }
        }
        if (!cached && this.all) {
          var iterResult = new iterresult_default(what, args);
          for (var i = 0; i < this.all.length; i++) {
            if (!iterResult.accept(this.all[i]))
              break;
          }
          cached = iterResult.getValue();
          this._cacheAdd(what, cached, args);
        }
        return isArray(cached) ? cloneDates(cached) : cached instanceof Date ? clone(cached) : cached;
      };
      return Cache2;
    })()
  );

  // node_modules/rrule/dist/esm/masks.js
  var M365MASK = __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], repeat(1, 31), true), repeat(2, 28), true), repeat(3, 31), true), repeat(4, 30), true), repeat(5, 31), true), repeat(6, 30), true), repeat(7, 31), true), repeat(8, 31), true), repeat(9, 30), true), repeat(10, 31), true), repeat(11, 30), true), repeat(12, 31), true), repeat(1, 7), true);
  var M366MASK = __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], repeat(1, 31), true), repeat(2, 29), true), repeat(3, 31), true), repeat(4, 30), true), repeat(5, 31), true), repeat(6, 30), true), repeat(7, 31), true), repeat(8, 31), true), repeat(9, 30), true), repeat(10, 31), true), repeat(11, 30), true), repeat(12, 31), true), repeat(1, 7), true);
  var M28 = range(1, 29);
  var M29 = range(1, 30);
  var M30 = range(1, 31);
  var M31 = range(1, 32);
  var MDAY366MASK = __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], M31, true), M29, true), M31, true), M30, true), M31, true), M30, true), M31, true), M31, true), M30, true), M31, true), M30, true), M31, true), M31.slice(0, 7), true);
  var MDAY365MASK = __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], M31, true), M28, true), M31, true), M30, true), M31, true), M30, true), M31, true), M31, true), M30, true), M31, true), M30, true), M31, true), M31.slice(0, 7), true);
  var NM28 = range(-28, 0);
  var NM29 = range(-29, 0);
  var NM30 = range(-30, 0);
  var NM31 = range(-31, 0);
  var NMDAY366MASK = __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], NM31, true), NM29, true), NM31, true), NM30, true), NM31, true), NM30, true), NM31, true), NM31, true), NM30, true), NM31, true), NM30, true), NM31, true), NM31.slice(0, 7), true);
  var NMDAY365MASK = __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], NM31, true), NM28, true), NM31, true), NM30, true), NM31, true), NM30, true), NM31, true), NM31, true), NM30, true), NM31, true), NM30, true), NM31, true), NM31.slice(0, 7), true);
  var M366RANGE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
  var M365RANGE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
  var WDAYMASK = (function() {
    var wdaymask = [];
    for (var i = 0; i < 55; i++)
      wdaymask = wdaymask.concat(range(7));
    return wdaymask;
  })();

  // node_modules/rrule/dist/esm/iterinfo/yearinfo.js
  function rebuildYear(year, options) {
    var firstyday = datetime(year, 1, 1);
    var yearlen = isLeapYear(year) ? 366 : 365;
    var nextyearlen = isLeapYear(year + 1) ? 366 : 365;
    var yearordinal = toOrdinal(firstyday);
    var yearweekday = getWeekday(firstyday);
    var result = __assign(__assign({ yearlen, nextyearlen, yearordinal, yearweekday }, baseYearMasks(year)), { wnomask: null });
    if (empty(options.byweekno)) {
      return result;
    }
    result.wnomask = repeat(0, yearlen + 7);
    var firstwkst;
    var wyearlen;
    var no1wkst = firstwkst = pymod(7 - yearweekday + options.wkst, 7);
    if (no1wkst >= 4) {
      no1wkst = 0;
      wyearlen = result.yearlen + pymod(yearweekday - options.wkst, 7);
    } else {
      wyearlen = yearlen - no1wkst;
    }
    var div = Math.floor(wyearlen / 7);
    var mod = pymod(wyearlen, 7);
    var numweeks = Math.floor(div + mod / 4);
    for (var j = 0; j < options.byweekno.length; j++) {
      var n = options.byweekno[j];
      if (n < 0) {
        n += numweeks + 1;
      }
      if (!(n > 0 && n <= numweeks)) {
        continue;
      }
      var i = void 0;
      if (n > 1) {
        i = no1wkst + (n - 1) * 7;
        if (no1wkst !== firstwkst) {
          i -= 7 - firstwkst;
        }
      } else {
        i = no1wkst;
      }
      for (var k = 0; k < 7; k++) {
        result.wnomask[i] = 1;
        i++;
        if (result.wdaymask[i] === options.wkst)
          break;
      }
    }
    if (includes(options.byweekno, 1)) {
      var i = no1wkst + numweeks * 7;
      if (no1wkst !== firstwkst)
        i -= 7 - firstwkst;
      if (i < yearlen) {
        for (var j = 0; j < 7; j++) {
          result.wnomask[i] = 1;
          i += 1;
          if (result.wdaymask[i] === options.wkst)
            break;
        }
      }
    }
    if (no1wkst) {
      var lnumweeks = void 0;
      if (!includes(options.byweekno, -1)) {
        var lyearweekday = getWeekday(datetime(year - 1, 1, 1));
        var lno1wkst = pymod(7 - lyearweekday.valueOf() + options.wkst, 7);
        var lyearlen = isLeapYear(year - 1) ? 366 : 365;
        var weekst = void 0;
        if (lno1wkst >= 4) {
          lno1wkst = 0;
          weekst = lyearlen + pymod(lyearweekday - options.wkst, 7);
        } else {
          weekst = yearlen - no1wkst;
        }
        lnumweeks = Math.floor(52 + pymod(weekst, 7) / 4);
      } else {
        lnumweeks = -1;
      }
      if (includes(options.byweekno, lnumweeks)) {
        for (var i = 0; i < no1wkst; i++)
          result.wnomask[i] = 1;
      }
    }
    return result;
  }
  function baseYearMasks(year) {
    var yearlen = isLeapYear(year) ? 366 : 365;
    var firstyday = datetime(year, 1, 1);
    var wday = getWeekday(firstyday);
    if (yearlen === 365) {
      return {
        mmask: M365MASK,
        mdaymask: MDAY365MASK,
        nmdaymask: NMDAY365MASK,
        wdaymask: WDAYMASK.slice(wday),
        mrange: M365RANGE
      };
    }
    return {
      mmask: M366MASK,
      mdaymask: MDAY366MASK,
      nmdaymask: NMDAY366MASK,
      wdaymask: WDAYMASK.slice(wday),
      mrange: M366RANGE
    };
  }

  // node_modules/rrule/dist/esm/iterinfo/monthinfo.js
  function rebuildMonth(year, month, yearlen, mrange, wdaymask, options) {
    var result = {
      lastyear: year,
      lastmonth: month,
      nwdaymask: []
    };
    var ranges = [];
    if (options.freq === RRule.YEARLY) {
      if (empty(options.bymonth)) {
        ranges = [[0, yearlen]];
      } else {
        for (var j = 0; j < options.bymonth.length; j++) {
          month = options.bymonth[j];
          ranges.push(mrange.slice(month - 1, month + 1));
        }
      }
    } else if (options.freq === RRule.MONTHLY) {
      ranges = [mrange.slice(month - 1, month + 1)];
    }
    if (empty(ranges)) {
      return result;
    }
    result.nwdaymask = repeat(0, yearlen);
    for (var j = 0; j < ranges.length; j++) {
      var rang = ranges[j];
      var first = rang[0];
      var last = rang[1] - 1;
      for (var k = 0; k < options.bynweekday.length; k++) {
        var i = void 0;
        var _a = options.bynweekday[k], wday = _a[0], n = _a[1];
        if (n < 0) {
          i = last + (n + 1) * 7;
          i -= pymod(wdaymask[i] - wday, 7);
        } else {
          i = first + (n - 1) * 7;
          i += pymod(7 - wdaymask[i] + wday, 7);
        }
        if (first <= i && i <= last)
          result.nwdaymask[i] = 1;
      }
    }
    return result;
  }

  // node_modules/rrule/dist/esm/iterinfo/easter.js
  function easter(y, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    var a = y % 19;
    var b = Math.floor(y / 100);
    var c = y % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = Math.floor(19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = Math.floor(32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = (h + l - 7 * m + 114) % 31 + 1;
    var date2 = Date.UTC(y, month - 1, day + offset);
    var yearStart = Date.UTC(y, 0, 1);
    return [Math.ceil((date2 - yearStart) / (1e3 * 60 * 60 * 24))];
  }

  // node_modules/rrule/dist/esm/iterinfo/index.js
  var Iterinfo = (
    /** @class */
    (function() {
      function Iterinfo2(options) {
        this.options = options;
      }
      Iterinfo2.prototype.rebuild = function(year, month) {
        var options = this.options;
        if (year !== this.lastyear) {
          this.yearinfo = rebuildYear(year, options);
        }
        if (notEmpty(options.bynweekday) && (month !== this.lastmonth || year !== this.lastyear)) {
          var _a = this.yearinfo, yearlen = _a.yearlen, mrange = _a.mrange, wdaymask = _a.wdaymask;
          this.monthinfo = rebuildMonth(year, month, yearlen, mrange, wdaymask, options);
        }
        if (isPresent(options.byeaster)) {
          this.eastermask = easter(year, options.byeaster);
        }
      };
      Object.defineProperty(Iterinfo2.prototype, "lastyear", {
        get: function() {
          return this.monthinfo ? this.monthinfo.lastyear : null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "lastmonth", {
        get: function() {
          return this.monthinfo ? this.monthinfo.lastmonth : null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "yearlen", {
        get: function() {
          return this.yearinfo.yearlen;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "yearordinal", {
        get: function() {
          return this.yearinfo.yearordinal;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "mrange", {
        get: function() {
          return this.yearinfo.mrange;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "wdaymask", {
        get: function() {
          return this.yearinfo.wdaymask;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "mmask", {
        get: function() {
          return this.yearinfo.mmask;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "wnomask", {
        get: function() {
          return this.yearinfo.wnomask;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "nwdaymask", {
        get: function() {
          return this.monthinfo ? this.monthinfo.nwdaymask : [];
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "nextyearlen", {
        get: function() {
          return this.yearinfo.nextyearlen;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "mdaymask", {
        get: function() {
          return this.yearinfo.mdaymask;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Iterinfo2.prototype, "nmdaymask", {
        get: function() {
          return this.yearinfo.nmdaymask;
        },
        enumerable: false,
        configurable: true
      });
      Iterinfo2.prototype.ydayset = function() {
        return [range(this.yearlen), 0, this.yearlen];
      };
      Iterinfo2.prototype.mdayset = function(_, month) {
        var start = this.mrange[month - 1];
        var end = this.mrange[month];
        var set = repeat(null, this.yearlen);
        for (var i = start; i < end; i++)
          set[i] = i;
        return [set, start, end];
      };
      Iterinfo2.prototype.wdayset = function(year, month, day) {
        var set = repeat(null, this.yearlen + 7);
        var i = toOrdinal(datetime(year, month, day)) - this.yearordinal;
        var start = i;
        for (var j = 0; j < 7; j++) {
          set[i] = i;
          ++i;
          if (this.wdaymask[i] === this.options.wkst)
            break;
        }
        return [set, start, i];
      };
      Iterinfo2.prototype.ddayset = function(year, month, day) {
        var set = repeat(null, this.yearlen);
        var i = toOrdinal(datetime(year, month, day)) - this.yearordinal;
        set[i] = i;
        return [set, i, i + 1];
      };
      Iterinfo2.prototype.htimeset = function(hour, _, second, millisecond) {
        var _this = this;
        var set = [];
        this.options.byminute.forEach(function(minute) {
          set = set.concat(_this.mtimeset(hour, minute, second, millisecond));
        });
        sort(set);
        return set;
      };
      Iterinfo2.prototype.mtimeset = function(hour, minute, _, millisecond) {
        var set = this.options.bysecond.map(function(second) {
          return new Time(hour, minute, second, millisecond);
        });
        sort(set);
        return set;
      };
      Iterinfo2.prototype.stimeset = function(hour, minute, second, millisecond) {
        return [new Time(hour, minute, second, millisecond)];
      };
      Iterinfo2.prototype.getdayset = function(freq) {
        switch (freq) {
          case Frequency.YEARLY:
            return this.ydayset.bind(this);
          case Frequency.MONTHLY:
            return this.mdayset.bind(this);
          case Frequency.WEEKLY:
            return this.wdayset.bind(this);
          case Frequency.DAILY:
            return this.ddayset.bind(this);
          default:
            return this.ddayset.bind(this);
        }
      };
      Iterinfo2.prototype.gettimeset = function(freq) {
        switch (freq) {
          case Frequency.HOURLY:
            return this.htimeset.bind(this);
          case Frequency.MINUTELY:
            return this.mtimeset.bind(this);
          case Frequency.SECONDLY:
            return this.stimeset.bind(this);
        }
      };
      return Iterinfo2;
    })()
  );
  var iterinfo_default = Iterinfo;

  // node_modules/rrule/dist/esm/iter/poslist.js
  function buildPoslist(bysetpos, timeset, start, end, ii, dayset) {
    var poslist = [];
    for (var j = 0; j < bysetpos.length; j++) {
      var daypos = void 0;
      var timepos = void 0;
      var pos = bysetpos[j];
      if (pos < 0) {
        daypos = Math.floor(pos / timeset.length);
        timepos = pymod(pos, timeset.length);
      } else {
        daypos = Math.floor((pos - 1) / timeset.length);
        timepos = pymod(pos - 1, timeset.length);
      }
      var tmp = [];
      for (var k = start; k < end; k++) {
        var val = dayset[k];
        if (!isPresent(val))
          continue;
        tmp.push(val);
      }
      var i = void 0;
      if (daypos < 0) {
        i = tmp.slice(daypos)[0];
      } else {
        i = tmp[daypos];
      }
      var time = timeset[timepos];
      var date2 = fromOrdinal(ii.yearordinal + i);
      var res = combine(date2, time);
      if (!includes(poslist, res))
        poslist.push(res);
    }
    sort(poslist);
    return poslist;
  }

  // node_modules/rrule/dist/esm/iter/index.js
  function iter(iterResult, options) {
    var dtstart = options.dtstart, freq = options.freq, interval = options.interval, until = options.until, bysetpos = options.bysetpos;
    var count = options.count;
    if (count === 0 || interval === 0) {
      return emitResult(iterResult);
    }
    var counterDate = DateTime.fromDate(dtstart);
    var ii = new iterinfo_default(options);
    ii.rebuild(counterDate.year, counterDate.month);
    var timeset = makeTimeset(ii, counterDate, options);
    for (; ; ) {
      var _a = ii.getdayset(freq)(counterDate.year, counterDate.month, counterDate.day), dayset = _a[0], start = _a[1], end = _a[2];
      var filtered = removeFilteredDays(dayset, start, end, ii, options);
      if (notEmpty(bysetpos)) {
        var poslist = buildPoslist(bysetpos, timeset, start, end, ii, dayset);
        for (var j = 0; j < poslist.length; j++) {
          var res = poslist[j];
          if (until && res > until) {
            return emitResult(iterResult);
          }
          if (res >= dtstart) {
            var rezonedDate = rezoneIfNeeded(res, options);
            if (!iterResult.accept(rezonedDate)) {
              return emitResult(iterResult);
            }
            if (count) {
              --count;
              if (!count) {
                return emitResult(iterResult);
              }
            }
          }
        }
      } else {
        for (var j = start; j < end; j++) {
          var currentDay = dayset[j];
          if (!isPresent(currentDay)) {
            continue;
          }
          var date2 = fromOrdinal(ii.yearordinal + currentDay);
          for (var k = 0; k < timeset.length; k++) {
            var time = timeset[k];
            var res = combine(date2, time);
            if (until && res > until) {
              return emitResult(iterResult);
            }
            if (res >= dtstart) {
              var rezonedDate = rezoneIfNeeded(res, options);
              if (!iterResult.accept(rezonedDate)) {
                return emitResult(iterResult);
              }
              if (count) {
                --count;
                if (!count) {
                  return emitResult(iterResult);
                }
              }
            }
          }
        }
      }
      if (options.interval === 0) {
        return emitResult(iterResult);
      }
      counterDate.add(options, filtered);
      if (counterDate.year > MAXYEAR) {
        return emitResult(iterResult);
      }
      if (!freqIsDailyOrGreater(freq)) {
        timeset = ii.gettimeset(freq)(counterDate.hour, counterDate.minute, counterDate.second, 0);
      }
      ii.rebuild(counterDate.year, counterDate.month);
    }
  }
  function isFiltered(ii, currentDay, options) {
    var bymonth = options.bymonth, byweekno = options.byweekno, byweekday = options.byweekday, byeaster = options.byeaster, bymonthday = options.bymonthday, bynmonthday = options.bynmonthday, byyearday = options.byyearday;
    return notEmpty(bymonth) && !includes(bymonth, ii.mmask[currentDay]) || notEmpty(byweekno) && !ii.wnomask[currentDay] || notEmpty(byweekday) && !includes(byweekday, ii.wdaymask[currentDay]) || notEmpty(ii.nwdaymask) && !ii.nwdaymask[currentDay] || byeaster !== null && !includes(ii.eastermask, currentDay) || (notEmpty(bymonthday) || notEmpty(bynmonthday)) && !includes(bymonthday, ii.mdaymask[currentDay]) && !includes(bynmonthday, ii.nmdaymask[currentDay]) || notEmpty(byyearday) && (currentDay < ii.yearlen && !includes(byyearday, currentDay + 1) && !includes(byyearday, -ii.yearlen + currentDay) || currentDay >= ii.yearlen && !includes(byyearday, currentDay + 1 - ii.yearlen) && !includes(byyearday, -ii.nextyearlen + currentDay - ii.yearlen));
  }
  function rezoneIfNeeded(date2, options) {
    return new DateWithZone(date2, options.tzid).rezonedDate();
  }
  function emitResult(iterResult) {
    return iterResult.getValue();
  }
  function removeFilteredDays(dayset, start, end, ii, options) {
    var filtered = false;
    for (var dayCounter = start; dayCounter < end; dayCounter++) {
      var currentDay = dayset[dayCounter];
      filtered = isFiltered(ii, currentDay, options);
      if (filtered)
        dayset[currentDay] = null;
    }
    return filtered;
  }
  function makeTimeset(ii, counterDate, options) {
    var freq = options.freq, byhour = options.byhour, byminute = options.byminute, bysecond = options.bysecond;
    if (freqIsDailyOrGreater(freq)) {
      return buildTimeset(options);
    }
    if (freq >= RRule.HOURLY && notEmpty(byhour) && !includes(byhour, counterDate.hour) || freq >= RRule.MINUTELY && notEmpty(byminute) && !includes(byminute, counterDate.minute) || freq >= RRule.SECONDLY && notEmpty(bysecond) && !includes(bysecond, counterDate.second)) {
      return [];
    }
    return ii.gettimeset(freq)(counterDate.hour, counterDate.minute, counterDate.second, counterDate.millisecond);
  }

  // node_modules/rrule/dist/esm/rrule.js
  var Days = {
    MO: new Weekday(0),
    TU: new Weekday(1),
    WE: new Weekday(2),
    TH: new Weekday(3),
    FR: new Weekday(4),
    SA: new Weekday(5),
    SU: new Weekday(6)
  };
  var DEFAULT_OPTIONS = {
    freq: Frequency.YEARLY,
    dtstart: null,
    interval: 1,
    wkst: Days.MO,
    count: null,
    until: null,
    tzid: null,
    bysetpos: null,
    bymonth: null,
    bymonthday: null,
    bynmonthday: null,
    byyearday: null,
    byweekno: null,
    byweekday: null,
    bynweekday: null,
    byhour: null,
    byminute: null,
    bysecond: null,
    byeaster: null
  };
  var defaultKeys = Object.keys(DEFAULT_OPTIONS);
  var RRule = (
    /** @class */
    (function() {
      function RRule3(options, noCache) {
        if (options === void 0) {
          options = {};
        }
        if (noCache === void 0) {
          noCache = false;
        }
        this._cache = noCache ? null : new Cache();
        this.origOptions = initializeOptions(options);
        var parsedOptions = parseOptions(options).parsedOptions;
        this.options = parsedOptions;
      }
      RRule3.parseText = function(text, language) {
        return parseText(text, language);
      };
      RRule3.fromText = function(text, language) {
        return fromText(text, language);
      };
      RRule3.fromString = function(str) {
        return new RRule3(RRule3.parseString(str) || void 0);
      };
      RRule3.prototype._iter = function(iterResult) {
        return iter(iterResult, this.options);
      };
      RRule3.prototype._cacheGet = function(what, args) {
        if (!this._cache)
          return false;
        return this._cache._cacheGet(what, args);
      };
      RRule3.prototype._cacheAdd = function(what, value, args) {
        if (!this._cache)
          return;
        return this._cache._cacheAdd(what, value, args);
      };
      RRule3.prototype.all = function(iterator) {
        if (iterator) {
          return this._iter(new callbackiterresult_default("all", {}, iterator));
        }
        var result = this._cacheGet("all");
        if (result === false) {
          result = this._iter(new iterresult_default("all", {}));
          this._cacheAdd("all", result);
        }
        return result;
      };
      RRule3.prototype.between = function(after, before, inc, iterator) {
        if (inc === void 0) {
          inc = false;
        }
        if (!isValidDate(after) || !isValidDate(before)) {
          throw new Error("Invalid date passed in to RRule.between");
        }
        var args = {
          before,
          after,
          inc
        };
        if (iterator) {
          return this._iter(new callbackiterresult_default("between", args, iterator));
        }
        var result = this._cacheGet("between", args);
        if (result === false) {
          result = this._iter(new iterresult_default("between", args));
          this._cacheAdd("between", result, args);
        }
        return result;
      };
      RRule3.prototype.before = function(dt, inc) {
        if (inc === void 0) {
          inc = false;
        }
        if (!isValidDate(dt)) {
          throw new Error("Invalid date passed in to RRule.before");
        }
        var args = { dt, inc };
        var result = this._cacheGet("before", args);
        if (result === false) {
          result = this._iter(new iterresult_default("before", args));
          this._cacheAdd("before", result, args);
        }
        return result;
      };
      RRule3.prototype.after = function(dt, inc) {
        if (inc === void 0) {
          inc = false;
        }
        if (!isValidDate(dt)) {
          throw new Error("Invalid date passed in to RRule.after");
        }
        var args = { dt, inc };
        var result = this._cacheGet("after", args);
        if (result === false) {
          result = this._iter(new iterresult_default("after", args));
          this._cacheAdd("after", result, args);
        }
        return result;
      };
      RRule3.prototype.count = function() {
        return this.all().length;
      };
      RRule3.prototype.toString = function() {
        return optionsToString(this.origOptions);
      };
      RRule3.prototype.toText = function(gettext, language, dateFormatter) {
        return toText(this, gettext, language, dateFormatter);
      };
      RRule3.prototype.isFullyConvertibleToText = function() {
        return isFullyConvertible(this);
      };
      RRule3.prototype.clone = function() {
        return new RRule3(this.origOptions);
      };
      RRule3.FREQUENCIES = [
        "YEARLY",
        "MONTHLY",
        "WEEKLY",
        "DAILY",
        "HOURLY",
        "MINUTELY",
        "SECONDLY"
      ];
      RRule3.YEARLY = Frequency.YEARLY;
      RRule3.MONTHLY = Frequency.MONTHLY;
      RRule3.WEEKLY = Frequency.WEEKLY;
      RRule3.DAILY = Frequency.DAILY;
      RRule3.HOURLY = Frequency.HOURLY;
      RRule3.MINUTELY = Frequency.MINUTELY;
      RRule3.SECONDLY = Frequency.SECONDLY;
      RRule3.MO = Days.MO;
      RRule3.TU = Days.TU;
      RRule3.WE = Days.WE;
      RRule3.TH = Days.TH;
      RRule3.FR = Days.FR;
      RRule3.SA = Days.SA;
      RRule3.SU = Days.SU;
      RRule3.parseString = parseString;
      RRule3.optionsToString = optionsToString;
      return RRule3;
    })()
  );

  // node_modules/rrule/dist/esm/iterset.js
  function iterSet(iterResult, _rrule, _exrule, _rdate, _exdate, tzid) {
    var _exdateHash = {};
    var _accept = iterResult.accept;
    function evalExdate(after, before) {
      _exrule.forEach(function(rrule) {
        rrule.between(after, before, true).forEach(function(date2) {
          _exdateHash[Number(date2)] = true;
        });
      });
    }
    _exdate.forEach(function(date2) {
      var zonedDate2 = new DateWithZone(date2, tzid).rezonedDate();
      _exdateHash[Number(zonedDate2)] = true;
    });
    iterResult.accept = function(date2) {
      var dt = Number(date2);
      if (isNaN(dt))
        return _accept.call(this, date2);
      if (!_exdateHash[dt]) {
        evalExdate(new Date(dt - 1), new Date(dt + 1));
        if (!_exdateHash[dt]) {
          _exdateHash[dt] = true;
          return _accept.call(this, date2);
        }
      }
      return true;
    };
    if (iterResult.method === "between") {
      evalExdate(iterResult.args.after, iterResult.args.before);
      iterResult.accept = function(date2) {
        var dt = Number(date2);
        if (!_exdateHash[dt]) {
          _exdateHash[dt] = true;
          return _accept.call(this, date2);
        }
        return true;
      };
    }
    for (var i = 0; i < _rdate.length; i++) {
      var zonedDate = new DateWithZone(_rdate[i], tzid).rezonedDate();
      if (!iterResult.accept(new Date(zonedDate.getTime())))
        break;
    }
    _rrule.forEach(function(rrule) {
      iter(iterResult, rrule.options);
    });
    var res = iterResult._result;
    sort(res);
    switch (iterResult.method) {
      case "all":
      case "between":
        return res;
      case "before":
        return res.length && res[res.length - 1] || null;
      case "after":
      default:
        return res.length && res[0] || null;
    }
  }

  // node_modules/rrule/dist/esm/rrulestr.js
  var DEFAULT_OPTIONS2 = {
    dtstart: null,
    cache: false,
    unfold: false,
    forceset: false,
    compatible: false,
    tzid: null
  };
  function parseInput(s, options) {
    var rrulevals = [];
    var rdatevals = [];
    var exrulevals = [];
    var exdatevals = [];
    var parsedDtstart = parseDtstart(s);
    var dtstart = parsedDtstart.dtstart;
    var tzid = parsedDtstart.tzid;
    var lines = splitIntoLines(s, options.unfold);
    lines.forEach(function(line) {
      var _a;
      if (!line)
        return;
      var _b = breakDownLine(line), name = _b.name, parms = _b.parms, value = _b.value;
      switch (name.toUpperCase()) {
        case "RRULE":
          if (parms.length) {
            throw new Error("unsupported RRULE parm: ".concat(parms.join(",")));
          }
          rrulevals.push(parseString(line));
          break;
        case "RDATE":
          var _c = (_a = /RDATE(?:;TZID=([^:=]+))?/i.exec(line)) !== null && _a !== void 0 ? _a : [], rdateTzid = _c[1];
          if (rdateTzid && !tzid) {
            tzid = rdateTzid;
          }
          rdatevals = rdatevals.concat(parseRDate(value, parms));
          break;
        case "EXRULE":
          if (parms.length) {
            throw new Error("unsupported EXRULE parm: ".concat(parms.join(",")));
          }
          exrulevals.push(parseString(value));
          break;
        case "EXDATE":
          exdatevals = exdatevals.concat(parseRDate(value, parms));
          break;
        case "DTSTART":
          break;
        default:
          throw new Error("unsupported property: " + name);
      }
    });
    return {
      dtstart,
      tzid,
      rrulevals,
      rdatevals,
      exrulevals,
      exdatevals
    };
  }
  function buildRule(s, options) {
    var _a = parseInput(s, options), rrulevals = _a.rrulevals, rdatevals = _a.rdatevals, exrulevals = _a.exrulevals, exdatevals = _a.exdatevals, dtstart = _a.dtstart, tzid = _a.tzid;
    var noCache = options.cache === false;
    if (options.compatible) {
      options.forceset = true;
      options.unfold = true;
    }
    if (options.forceset || rrulevals.length > 1 || rdatevals.length || exrulevals.length || exdatevals.length) {
      var rset_1 = new RRuleSet(noCache);
      rset_1.dtstart(dtstart);
      rset_1.tzid(tzid || void 0);
      rrulevals.forEach(function(val2) {
        rset_1.rrule(new RRule(groomRruleOptions(val2, dtstart, tzid), noCache));
      });
      rdatevals.forEach(function(date2) {
        rset_1.rdate(date2);
      });
      exrulevals.forEach(function(val2) {
        rset_1.exrule(new RRule(groomRruleOptions(val2, dtstart, tzid), noCache));
      });
      exdatevals.forEach(function(date2) {
        rset_1.exdate(date2);
      });
      if (options.compatible && options.dtstart)
        rset_1.rdate(dtstart);
      return rset_1;
    }
    var val = rrulevals[0] || {};
    return new RRule(groomRruleOptions(val, val.dtstart || options.dtstart || dtstart, val.tzid || options.tzid || tzid), noCache);
  }
  function rrulestr(s, options) {
    if (options === void 0) {
      options = {};
    }
    return buildRule(s, initializeOptions2(options));
  }
  function groomRruleOptions(val, dtstart, tzid) {
    return __assign(__assign({}, val), { dtstart, tzid });
  }
  function initializeOptions2(options) {
    var invalid = [];
    var keys = Object.keys(options);
    var defaultKeys2 = Object.keys(DEFAULT_OPTIONS2);
    keys.forEach(function(key) {
      if (!includes(defaultKeys2, key))
        invalid.push(key);
    });
    if (invalid.length) {
      throw new Error("Invalid options: " + invalid.join(", "));
    }
    return __assign(__assign({}, DEFAULT_OPTIONS2), options);
  }
  function extractName(line) {
    if (line.indexOf(":") === -1) {
      return {
        name: "RRULE",
        value: line
      };
    }
    var _a = split(line, ":", 1), name = _a[0], value = _a[1];
    return {
      name,
      value
    };
  }
  function breakDownLine(line) {
    var _a = extractName(line), name = _a.name, value = _a.value;
    var parms = name.split(";");
    if (!parms)
      throw new Error("empty property name");
    return {
      name: parms[0].toUpperCase(),
      parms: parms.slice(1),
      value
    };
  }
  function splitIntoLines(s, unfold) {
    if (unfold === void 0) {
      unfold = false;
    }
    s = s && s.trim();
    if (!s)
      throw new Error("Invalid empty string");
    if (!unfold) {
      return s.split(/\s/);
    }
    var lines = s.split("\n");
    var i = 0;
    while (i < lines.length) {
      var line = lines[i] = lines[i].replace(/\s+$/g, "");
      if (!line) {
        lines.splice(i, 1);
      } else if (i > 0 && line[0] === " ") {
        lines[i - 1] += line.slice(1);
        lines.splice(i, 1);
      } else {
        i += 1;
      }
    }
    return lines;
  }
  function validateDateParm(parms) {
    parms.forEach(function(parm) {
      if (!/(VALUE=DATE(-TIME)?)|(TZID=)/.test(parm)) {
        throw new Error("unsupported RDATE/EXDATE parm: " + parm);
      }
    });
  }
  function parseRDate(rdateval, parms) {
    validateDateParm(parms);
    return rdateval.split(",").map(function(datestr) {
      return untilStringToDate(datestr);
    });
  }

  // node_modules/rrule/dist/esm/rruleset.js
  function createGetterSetter(fieldName) {
    var _this = this;
    return function(field) {
      if (field !== void 0) {
        _this["_".concat(fieldName)] = field;
      }
      if (_this["_".concat(fieldName)] !== void 0) {
        return _this["_".concat(fieldName)];
      }
      for (var i = 0; i < _this._rrule.length; i++) {
        var field_1 = _this._rrule[i].origOptions[fieldName];
        if (field_1) {
          return field_1;
        }
      }
    };
  }
  var RRuleSet = (
    /** @class */
    (function(_super) {
      __extends(RRuleSet2, _super);
      function RRuleSet2(noCache) {
        if (noCache === void 0) {
          noCache = false;
        }
        var _this = _super.call(this, {}, noCache) || this;
        _this.dtstart = createGetterSetter.apply(_this, ["dtstart"]);
        _this.tzid = createGetterSetter.apply(_this, ["tzid"]);
        _this._rrule = [];
        _this._rdate = [];
        _this._exrule = [];
        _this._exdate = [];
        return _this;
      }
      RRuleSet2.prototype._iter = function(iterResult) {
        return iterSet(iterResult, this._rrule, this._exrule, this._rdate, this._exdate, this.tzid());
      };
      RRuleSet2.prototype.rrule = function(rrule) {
        _addRule(rrule, this._rrule);
      };
      RRuleSet2.prototype.exrule = function(rrule) {
        _addRule(rrule, this._exrule);
      };
      RRuleSet2.prototype.rdate = function(date2) {
        _addDate(date2, this._rdate);
      };
      RRuleSet2.prototype.exdate = function(date2) {
        _addDate(date2, this._exdate);
      };
      RRuleSet2.prototype.rrules = function() {
        return this._rrule.map(function(e) {
          return rrulestr(e.toString());
        });
      };
      RRuleSet2.prototype.exrules = function() {
        return this._exrule.map(function(e) {
          return rrulestr(e.toString());
        });
      };
      RRuleSet2.prototype.rdates = function() {
        return this._rdate.map(function(e) {
          return new Date(e.getTime());
        });
      };
      RRuleSet2.prototype.exdates = function() {
        return this._exdate.map(function(e) {
          return new Date(e.getTime());
        });
      };
      RRuleSet2.prototype.valueOf = function() {
        var result = [];
        if (!this._rrule.length && this._dtstart) {
          result = result.concat(optionsToString({ dtstart: this._dtstart }));
        }
        this._rrule.forEach(function(rrule) {
          result = result.concat(rrule.toString().split("\n"));
        });
        this._exrule.forEach(function(exrule) {
          result = result.concat(exrule.toString().split("\n").map(function(line) {
            return line.replace(/^RRULE:/, "EXRULE:");
          }).filter(function(line) {
            return !/^DTSTART/.test(line);
          }));
        });
        if (this._rdate.length) {
          result.push(rdatesToString("RDATE", this._rdate, this.tzid()));
        }
        if (this._exdate.length) {
          result.push(rdatesToString("EXDATE", this._exdate, this.tzid()));
        }
        return result;
      };
      RRuleSet2.prototype.toString = function() {
        return this.valueOf().join("\n");
      };
      RRuleSet2.prototype.clone = function() {
        var rrs = new RRuleSet2(!!this._cache);
        this._rrule.forEach(function(rule) {
          return rrs.rrule(rule.clone());
        });
        this._exrule.forEach(function(rule) {
          return rrs.exrule(rule.clone());
        });
        this._rdate.forEach(function(date2) {
          return rrs.rdate(new Date(date2.getTime()));
        });
        this._exdate.forEach(function(date2) {
          return rrs.exdate(new Date(date2.getTime()));
        });
        return rrs;
      };
      return RRuleSet2;
    })(RRule)
  );
  function _addRule(rrule, collection) {
    if (!(rrule instanceof RRule)) {
      throw new TypeError(String(rrule) + " is not RRule instance");
    }
    if (!includes(collection.map(String), String(rrule))) {
      collection.push(rrule);
    }
  }
  function _addDate(date2, collection) {
    if (!(date2 instanceof Date)) {
      throw new TypeError(String(date2) + " is not Date instance");
    }
    if (!includes(collection.map(Number), Number(date2))) {
      collection.push(date2);
      sort(collection);
    }
  }
  function rdatesToString(param, rdates, tzid) {
    var isUTC = !tzid || tzid.toUpperCase() === "UTC";
    var header = isUTC ? "".concat(param, ":") : "".concat(param, ";TZID=").concat(tzid, ":");
    var dateString = rdates.map(function(rdate) {
      return timeToUntilString(rdate.valueOf(), isUTC);
    }).join(",");
    return "".concat(header).concat(dateString);
  }

  // packages/shared/src/moduleCatalog.js
  var moduleCatalog = Object.freeze([
    {
      "id": "questions",
      "name": "\u9898\u5E93",
      "path": "/questions",
      "navigation": "sidebar",
      "auxiliaryPanel": true,
      "webEnabled": true,
      "requires": []
    },
    {
      "id": "math",
      "name": "\u6570\u5B66\u5DE5\u574A",
      "path": "/math",
      "navigation": "sidebar",
      "auxiliaryPanel": true,
      "webEnabled": true,
      "requires": []
    },
    {
      "id": "resources",
      "name": "\u8D44\u6E90\u5E93",
      "path": "/resources",
      "navigation": "sidebar",
      "auxiliaryPanel": true,
      "webEnabled": true,
      "requires": []
    },
    {
      "id": "schedule",
      "name": "\u65E5\u7A0B",
      "path": "/calendar",
      "navigation": "top",
      "auxiliaryPanel": true,
      "webEnabled": true,
      "requires": []
    },
    {
      "id": "classroom",
      "name": "\u73ED\u7EA7",
      "path": "/classroom",
      "navigation": "sidebar",
      "auxiliaryPanel": true,
      "webEnabled": false,
      "requires": []
    }
  ].map((entry) => Object.freeze({ ...entry, requires: Object.freeze(entry.requires) })));
  var modulePorts = Object.freeze({});
  var moduleCatalogNavigationValues = Object.freeze(["sidebar", "top"]);

  // packages/shared/src/contract.js
  var workbenchPaths = Object.freeze({
    context: "/api/workbench/context",
    modules: "/api/modules"
  });
  var workbenchHeaders = Object.freeze({
    sessionCookie: "__Host-teachbuddy_session",
    browserProtection: "X-TeachBuddy-Request",
    browserProtectionValue: "1",
    idempotencyKey: "Idempotency-Key"
  });
  var workbenchMediaTypes = Object.freeze({
    json: "application/json",
    problem: "application/problem+json"
  });
  var workbenchLimits = Object.freeze({
    requestBodyBytes: 2 * 1024 * 1024,
    titleLength: 200,
    noteLength: 2e4,
    textRunLength: 2e4,
    latexLength: 1e4,
    pasteSourceLength: 1e5,
    documentBlocks: 1e3,
    paragraphRuns: 1e3
  });
  var workbenchProblemTypes = Object.freeze({
    invalidTimeZone: "/problems/workbench/invalid-time-zone",
    reminderNotFuture: "/problems/workbench/reminder-not-future",
    referenceDeleted: "/problems/workbench/reference-deleted",
    classMismatch: "/problems/workbench/class-mismatch",
    immutableSeries: "/problems/workbench/immutable-series",
    invalidMove: "/problems/workbench/invalid-move",
    malformedJson: "/problems/workbench/malformed-json",
    unauthenticated: "/problems/workbench/unauthenticated",
    requestNotAllowed: "/problems/workbench/request-not-allowed",
    notFound: "/problems/workbench/not-found",
    versionConflict: "/problems/workbench/version-conflict",
    referenceVersionConflict: "/problems/workbench/reference-version-conflict",
    idempotencyKeyReused: "/problems/workbench/idempotency-key-reused",
    objectDeleted: "/problems/workbench/object-deleted",
    payloadTooLarge: "/problems/workbench/payload-too-large",
    unsupportedMediaType: "/problems/workbench/unsupported-media-type",
    invalidInput: "/problems/workbench/invalid-input",
    temporarilyUnavailable: "/problems/workbench/temporarily-unavailable"
  });
  var workbenchInvalidInputReasons = Object.freeze([
    "required",
    "unknown-field",
    "invalid-type",
    "out-of-range",
    "empty-content",
    "duplicate-id",
    "invalid-reference",
    "unsupported-content-version"
  ]);
  var workbenchProblemStatus = Object.freeze({
    [workbenchProblemTypes.invalidTimeZone]: 422,
    [workbenchProblemTypes.reminderNotFuture]: 422,
    [workbenchProblemTypes.referenceDeleted]: 409,
    [workbenchProblemTypes.classMismatch]: 409,
    [workbenchProblemTypes.immutableSeries]: 409,
    [workbenchProblemTypes.invalidMove]: 409,
    [workbenchProblemTypes.malformedJson]: 400,
    [workbenchProblemTypes.unauthenticated]: 401,
    [workbenchProblemTypes.requestNotAllowed]: 403,
    [workbenchProblemTypes.notFound]: 404,
    [workbenchProblemTypes.versionConflict]: 409,
    [workbenchProblemTypes.referenceVersionConflict]: 409,
    [workbenchProblemTypes.idempotencyKeyReused]: 409,
    [workbenchProblemTypes.objectDeleted]: 409,
    [workbenchProblemTypes.payloadTooLarge]: 413,
    [workbenchProblemTypes.unsupportedMediaType]: 415,
    [workbenchProblemTypes.invalidInput]: 422,
    [workbenchProblemTypes.temporarilyUnavailable]: 503
  });

  // prototype/current-ui/data/data/schedule.js
  var ContractError = class extends Error {
    constructor(status, problem2, message) {
      super(message ?? `Workbench contract error ${status} ${problem2.type}`);
      this.name = "ContractError";
      this.status = status;
      this.problem = problem2;
    }
  };
  function problem(type, extra) {
    return { type, ...extra };
  }
  var problems = {
    malformedJson: () => problem(workbenchProblemTypes.malformedJson),
    unauthenticated: () => problem(workbenchProblemTypes.unauthenticated),
    requestNotAllowed: () => problem(workbenchProblemTypes.requestNotAllowed),
    notFound: () => problem(workbenchProblemTypes.notFound),
    versionConflict: (currentVersion) => problem(workbenchProblemTypes.versionConflict, { currentVersion }),
    referenceVersionConflict: (questionId, currentVersion) => problem(
      workbenchProblemTypes.referenceVersionConflict,
      { questionId, currentVersion }
    ),
    idempotencyKeyReused: () => problem(workbenchProblemTypes.idempotencyKeyReused),
    objectDeleted: () => problem(workbenchProblemTypes.objectDeleted),
    payloadTooLarge: () => problem(workbenchProblemTypes.payloadTooLarge),
    unsupportedMediaType: () => problem(workbenchProblemTypes.unsupportedMediaType),
    invalidInput: (field, reason) => {
      if (!workbenchInvalidInputReasons.includes(reason)) {
        throw new Error(`Unknown invalid-input reason: ${reason}`);
      }
      return problem(workbenchProblemTypes.invalidInput, { field, reason });
    },
    temporarilyUnavailable: () => problem(workbenchProblemTypes.temporarilyUnavailable)
  };
  function problemStatus(problemValue) {
    const status = workbenchProblemStatus[problemValue?.type];
    if (!status) {
      throw new Error(`Unknown workbench problem type: ${String(problemValue?.type)}`);
    }
    return status;
  }
  function contractError(problemValue, message) {
    return new ContractError(problemStatus(problemValue), problemValue, message);
  }
  function invalidInput(field, reason) {
    return contractError(problems.invalidInput(field, reason));
  }
  function raise(status, value) {
    return new ContractError(status, value);
  }
  var scheduleProblems = {
    invalidTimeZone: (field = "/timeZone") => raise(
      workbenchProblemStatus[workbenchProblemTypes.invalidTimeZone],
      problem(workbenchProblemTypes.invalidTimeZone, { field })
    ),
    reminderNotFuture: (field = "/reminder") => raise(
      workbenchProblemStatus[workbenchProblemTypes.reminderNotFuture],
      problem(workbenchProblemTypes.reminderNotFuture, { field })
    ),
    immutableSeries: () => raise(
      workbenchProblemStatus[workbenchProblemTypes.immutableSeries],
      problem(workbenchProblemTypes.immutableSeries)
    ),
    invalidMove: () => raise(
      workbenchProblemStatus[workbenchProblemTypes.invalidMove],
      problem(workbenchProblemTypes.invalidMove)
    ),
    /** version-conflict keeps the shared type and adds the conflicting object ID. */
    versionConflict: (objectId, currentVersion) => raise(
      workbenchProblemStatus[workbenchProblemTypes.versionConflict],
      problem(workbenchProblemTypes.versionConflict, { currentVersion, objectId })
    )
  };
  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  function joinPointer(pointer, key) {
    const escaped = String(key).replaceAll("~", "~0").replaceAll("/", "~1");
    return `${pointer}/${escaped}`;
  }
  function pointerDepth(pointer) {
    return pointer.split("/").length;
  }
  function ok(value) {
    return { ok: true, value };
  }
  function fail(field, reason) {
    return { ok: false, error: { field, reason } };
  }
  function lazyNode(value) {
    if (typeof value !== "function") return () => value;
    let resolved;
    let done = false;
    return () => {
      if (!done) {
        resolved = value();
        done = true;
      }
      return resolved;
    };
  }
  var schema = {
    object(fields) {
      const entries = Array.isArray(fields) ? fields : Object.entries(fields);
      return {
        kind: "object",
        fields: entries.map(([name, fieldSchema]) => [name, lazyNode(fieldSchema)])
      };
    },
    array(items, options = {}) {
      return {
        kind: "array",
        items: lazyNode(items),
        maxItems: options.maxItems
      };
    },
    string(options = {}) {
      return { kind: "string", ...options };
    },
    integer(options = {}) {
      return { kind: "integer", ...options };
    },
    boolean() {
      return { kind: "boolean" };
    },
    oneOf(variants) {
      return { kind: "oneOf", variants: variants.map((variant) => lazyNode(variant)) };
    }
  };
  function constReason(keyName) {
    return keyName === "type" || keyName === "version" ? "unsupported-content-version" : "out-of-range";
  }
  function discriminantOf(node) {
    if (node?.kind !== "object") return null;
    for (const [name, fieldSchema] of node.fields) {
      const field = fieldSchema();
      if (field.kind === "string" && "const" in field) return { name, value: field.const };
    }
    return null;
  }
  function validateOneOf(node, value, pointer, keyName) {
    const variants = node.variants.map((variant) => variant());
    const discriminants = variants.map(discriminantOf);
    if (isPlainObject(value) && discriminants.every(Boolean)) {
      const names = new Set(discriminants.map((discriminant) => discriminant.name));
      if (names.size === 1) {
        const [name] = names;
        const matchIndex = discriminants.findIndex((discriminant) => discriminant.value === value[name]);
        if (matchIndex >= 0) return validateSchema(variants[matchIndex], value, pointer, keyName);
        if (!(name in value)) return fail(joinPointer(pointer, name), "required");
        if (typeof value[name] !== "string") return fail(joinPointer(pointer, name), "invalid-type");
        return fail(joinPointer(pointer, name), constReason(name));
      }
    }
    const errors = [];
    for (const variant of variants) {
      const result = validateSchema(variant, value, pointer, keyName);
      if (result.ok) return result;
      errors.push(result.error);
    }
    errors.sort((a, b) => pointerDepth(b.field) - pointerDepth(a.field));
    return { ok: false, error: errors[0] };
  }
  function validateSchema(node, value, pointer = "", keyName = void 0) {
    switch (node.kind) {
      case "object": {
        if (!isPlainObject(value)) return fail(pointer, "invalid-type");
        const declared = new Set(node.fields.map(([name]) => name));
        const unknown = Object.keys(value).filter((key) => !declared.has(key)).sort();
        if (unknown.length) return fail(joinPointer(pointer, unknown[0]), "unknown-field");
        for (const [name, fieldSchema] of node.fields) {
          if (!(name in value)) return fail(joinPointer(pointer, name), "required");
          const result = validateSchema(fieldSchema(), value[name], joinPointer(pointer, name), name);
          if (!result.ok) return result;
        }
        return ok(value);
      }
      case "array": {
        if (!Array.isArray(value)) return fail(pointer, "invalid-type");
        if (node.maxItems !== void 0 && value.length > node.maxItems) return fail(pointer, "out-of-range");
        const itemSchema2 = node.items();
        for (let index = 0; index < value.length; index += 1) {
          const result = validateSchema(itemSchema2, value[index], joinPointer(pointer, index), String(index));
          if (!result.ok) return result;
        }
        return ok(value);
      }
      case "string": {
        if (typeof value !== "string") return fail(pointer, "invalid-type");
        if (node.nonBlank && value.trim() === "") return fail(pointer, "out-of-range");
        if (value === "" && node.minLength !== void 0 && node.minLength >= 1) return fail(pointer, "empty-content");
        if (node.minLength !== void 0 && value.length < node.minLength) return fail(pointer, "out-of-range");
        if (node.maxLength !== void 0 && value.length > node.maxLength) return fail(pointer, "out-of-range");
        if (node.pattern && !node.pattern.test(value)) return fail(pointer, "out-of-range");
        if (node.enum && !node.enum.includes(value)) return fail(pointer, "out-of-range");
        if ("const" in node && value !== node.const) return fail(pointer, constReason(keyName));
        return ok(value);
      }
      case "integer": {
        if (typeof value !== "number" || !Number.isInteger(value)) return fail(pointer, "invalid-type");
        if (node.min !== void 0 && value < node.min) return fail(pointer, "out-of-range");
        if (node.max !== void 0 && value > node.max) return fail(pointer, "out-of-range");
        if ("const" in node && value !== node.const) return fail(pointer, constReason(keyName));
        return ok(value);
      }
      case "boolean": {
        if (typeof value !== "boolean") return fail(pointer, "invalid-type");
        return ok(value);
      }
      case "oneOf":
        return validateOneOf(node, value, pointer, keyName);
      default:
        throw new Error(`Unknown schema node kind: ${String(node?.kind)}`);
    }
  }
  function validateBody(node, value) {
    const result = validateSchema(node, value);
    if (!result.ok) throw invalidInput(result.error.field, result.error.reason);
    return result.value;
  }
  var uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function validateIdPath(value, pointer = "/path/id") {
    if (typeof value !== "string" || !uuidPattern.test(value)) {
      throw invalidInput(pointer, "invalid-type");
    }
    return value;
  }
  var MIN_YEAR = 1900;
  var MAX_YEAR = 2100;
  var MS_PER_MINUTE = 6e4;
  var MS_PER_DAY = 864e5;
  var DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
  var TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
  function pad(value, length = 2) {
    return String(value).padStart(length, "0");
  }
  function parseCalendarDate(value) {
    if (typeof value !== "string") return null;
    const match = DATE_PATTERN.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year)) return null;
    if (month < 1 || month > 12) return null;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) return null;
    return { year, month, day };
  }
  function parseDate(value) {
    const parts = parseCalendarDate(value);
    if (!parts) return null;
    if (parts.year < MIN_YEAR || parts.year > MAX_YEAR) return null;
    return parts;
  }
  function isDate2(value) {
    return parseDate(value) !== null;
  }
  function toDateString({ year, month, day }) {
    return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  }
  function dateToUtcMs(value) {
    const parts = typeof value === "string" ? parseCalendarDate(value) : value;
    if (!parts) return Number.NaN;
    return Date.UTC(parts.year, parts.month - 1, parts.day);
  }
  function utcMsToDate(ms) {
    const date2 = new Date(ms);
    return toDateString({
      year: date2.getUTCFullYear(),
      month: date2.getUTCMonth() + 1,
      day: date2.getUTCDate()
    });
  }
  function addDays(value, count) {
    return utcMsToDate(dateToUtcMs(value) + count * MS_PER_DAY);
  }
  function diffDays(from, to) {
    return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / MS_PER_DAY);
  }
  function compareDates(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  function parseTimeOfDay(value) {
    if (typeof value !== "string") return null;
    const match = TIME_PATTERN.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }
  function isTimeOfDay(value) {
    return parseTimeOfDay(value) !== null;
  }
  function formatIsoZ(ms) {
    return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  function parseInstant(value) {
    if (typeof value !== "string" || !value.endsWith("Z")) return Number.NaN;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? Number.NaN : ms;
  }
  function isTimeZone(value) {
    if (typeof value !== "string" || value.length === 0 || value.length > 100) return false;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch (error) {
      return false;
    }
  }
  var formatterCache = /* @__PURE__ */ new Map();
  function zoneFormatter(zone) {
    let formatter = formatterCache.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      formatterCache.set(zone, formatter);
    }
    return formatter;
  }
  function zoneParts(zone, utcMs) {
    const instant = Math.floor(utcMs / 1e3) * 1e3;
    const parts = zoneFormatter(zone).formatToParts(new Date(instant));
    const read = (type) => Number(parts.find((part) => part.type === type)?.value);
    const hour = read("hour") % 24;
    return {
      date: `${pad(read("year"), 4)}-${pad(read("month"))}-${pad(read("day"))}`,
      minutes: hour * 60 + read("minute")
    };
  }
  function zoneOffsetMs(zone, utcMs) {
    const instant = Math.floor(utcMs / 1e3) * 1e3;
    const local = zoneParts(zone, instant);
    const localMs = dateToUtcMs(local.date) + local.minutes * MS_PER_MINUTE;
    return localMs - instant;
  }
  function localPartsAt(zone, utcMs) {
    return zoneParts(zone, utcMs);
  }
  function instantAt(zone, dateStr, minutes) {
    const wall = dateToUtcMs(dateStr) + minutes * MS_PER_MINUTE;
    const before = zoneOffsetMs(zone, wall - MS_PER_DAY / 2);
    const after = zoneOffsetMs(zone, wall + MS_PER_DAY / 2);
    const candidates = [.../* @__PURE__ */ new Set([wall - before, wall - after])].sort((a, b) => a - b);
    const exact = candidates.filter((candidate) => {
      const local = zoneParts(zone, candidate);
      return local.date === dateStr && local.minutes === minutes;
    });
    if (exact.length > 0) return { utcMs: exact[0], timeAdjusted: false };
    return { utcMs: candidates[candidates.length - 1], timeAdjusted: true };
  }
  function rangeInstants(zone, from, to) {
    const start = instantAt(zone, from, 0).utcMs;
    const end = instantAt(zone, addDays(to, 1), 0).utcMs;
    return { start, end };
  }
  var { RRule: RRule2 } = esm_exports;
  var frequencies = { daily: RRule2.DAILY, weekly: RRule2.WEEKLY, monthly: RRule2.MONTHLY, yearly: RRule2.YEARLY };
  var days = [RRule2.SU, RRule2.MO, RRule2.TU, RRule2.WE, RRule2.TH, RRule2.FR, RRule2.SA];
  var utcDate = (value) => /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  function recurrenceDates(entry, { from, to } = {}) {
    if (!entry.time || !entry.repeat) return [];
    const rule = entry.repeat;
    const start = utcDate(entry.time.date);
    const frequency = rule.frequency ?? "weekly";
    const options = {
      dtstart: start,
      freq: frequencies[frequency],
      interval: rule.interval ?? 1,
      until: utcDate(rule.until),
      wkst: RRule2.MO
    };
    if (rule.count) options.count = rule.count;
    if (frequency === "weekly") options.byweekday = (rule.weekdays ?? [start.getUTCDay()]).map((day) => days[day]);
    if (frequency === "monthly" && rule.monthly === "weekday") {
      options.byweekday = [days[start.getUTCDay()].nth(Math.ceil(start.getUTCDate() / 7))];
    }
    const recurrence = new RRule2(options);
    return recurrence.between(utcDate(from ?? entry.time.date), utcDate(to ?? rule.until), true).map((value) => value.toISOString().slice(0, 10));
  }
  function projectReminderTitle(entry) {
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const source = title !== "" ? title : String(entry.items?.[0]?.text ?? "").trim();
    return [...source].slice(0, 300).join("");
  }
  function templateContent(entry) {
    return {
      title: entry.title,
      items: entry.items,
      time: entry.time,
      reminder: entry.reminder,
      calendar: entry.calendar ?? { allDay: false, notes: "", tags: [] }
    };
  }
  function effectiveContent(entry, exception, originDate = null) {
    if (exception && exception.mode === "override" && exception.content) {
      return exception.content;
    }
    const template = templateContent(entry);
    if (originDate !== null && template.time) {
      return { ...template, time: { ...template.time, date: originDate } };
    }
    return template;
  }
  function instanceState(entry, originDate, exception) {
    if (entry.deletedAt) return "deleted";
    if (originDate !== null && entry.repeat && compareDates(originDate, entry.repeat.until) > 0) {
      return "outside-series";
    }
    if (exception && exception.mode === "cancelled") return "cancelled";
    return "active";
  }
  function instanceArmedAt(entry, armRow) {
    return armRow?.armedAt ?? entry.reminderArmedAt ?? entry.createdAt;
  }
  var seriesOriginDates = recurrenceDates;
  function fitsSeries(entry, originDate) {
    if (!entry.time) return false;
    if (entry.repeat?.frequency) return recurrenceDates({ ...entry, repeat: { ...entry.repeat, until: "2100-12-31" } }, { from: originDate, to: originDate }).length > 0;
    const distance = diffDays(entry.time.date, originDate);
    return distance >= 0 && distance % 7 === 0;
  }
  function isRepeating(entry) {
    return entry.repeat !== null && entry.repeat !== void 0;
  }
  function dueInstantMs(content) {
    if (!content.reminder || !content.time) return null;
    const start = instantAt(content.time.timeZone, content.time.date, parseTimeOfDay(content.time.startTime));
    const end = content.calendar?.allDay ? instantAt(content.time.timeZone, addDays(content.time.date, content.time.durationMinutes / 1440), 0).utcMs : start.utcMs + content.time.durationMinutes * 6e4;
    const offset = content.reminder.minutes * 6e4;
    const anchor = content.reminder.anchor === "start" ? start.utcMs : end;
    return content.reminder.side === "before" ? anchor - offset : anchor + offset;
  }
  function buildOccurrence({ entry, originDate, exception }) {
    const state = instanceState(entry, originDate, exception);
    const content = state === "active" ? effectiveContent(entry, exception, originDate) : effectiveContent(entry, null, originDate);
    const time = content.time;
    const start = instantAt(time.timeZone, time.date, parseTimeOfDay(time.startTime));
    const endsAtMs = content.calendar?.allDay ? instantAt(time.timeZone, addDays(time.date, time.durationMinutes / 1440), 0).utcMs : start.utcMs + time.durationMinutes * 6e4;
    const dueMs = dueInstantMs(content);
    return {
      key: { entryId: entry.id, originDate },
      entryVersion: entry.version,
      exception: Boolean(exception),
      state,
      title: content.title,
      items: content.items,
      calendar: content.calendar ?? entry.calendar ?? { allDay: false, notes: "", tags: [] },
      time,
      startsAt: formatIsoZ(start.utcMs),
      endsAt: formatIsoZ(endsAtMs),
      timeAdjusted: start.timeAdjusted,
      reminder: content.reminder ?? null,
      dueAt: dueMs === null ? null : formatIsoZ(dueMs),
      __startsAtMs: start.utcMs,
      __endsAtMs: endsAtMs
    };
  }
  function stripInternal(occurrence) {
    const { __startsAtMs, __endsAtMs, ...rest } = occurrence;
    return rest;
  }
  function intersects(occurrence, rangeStart, rangeEnd) {
    return occurrence.__startsAtMs < rangeEnd && occurrence.__endsAtMs > rangeStart;
  }
  function sortOccurrences(items) {
    return items.sort((a, b) => {
      if (a.__startsAtMs !== b.__startsAtMs) return a.__startsAtMs - b.__startsAtMs;
      if (a.key.entryId !== b.key.entryId) return a.key.entryId < b.key.entryId ? -1 : 1;
      const left = a.key.originDate ?? "";
      const right = b.key.originDate ?? "";
      if (left === right) return 0;
      return left < right ? -1 : 1;
    });
  }
  function listReminderCandidates(entries, exceptionsByEntry, armsByEntry, nowIso) {
    const now = parseInstant(nowIso);
    const candidates = [];
    for (const entry of entries) {
      if (entry.deletedAt || !entry.time) continue;
      const exceptions = exceptionsByEntry.get(entry.id) ?? [];
      if (!entry.reminder && !exceptions.some((value) => value.content?.reminder)) continue;
      const arms = armsByEntry.get(entry.id) ?? /* @__PURE__ */ new Map();
      const exceptionByDate = new Map(exceptions.map((item) => [item.originDate, item]));
      const consider = (originDate, exception) => {
        const state = instanceState(entry, originDate, exception);
        if (state !== "active") return;
        const content = effectiveContent(entry, exception, originDate);
        if (!content.reminder) return;
        const dueMs = dueInstantMs(content);
        if (dueMs === null) return;
        const armedMs = parseInstant(instanceArmedAt(entry, arms.get(originDate ?? "")));
        if (!(armedMs < dueMs && dueMs <= now)) return;
        candidates.push({
          key: { entryId: entry.id, originDate },
          title: projectReminderTitle(entry),
          dueAt: formatIsoZ(dueMs),
          armedAt: formatIsoZ(armedMs),
          __dueMs: dueMs
        });
      };
      if (!isRepeating(entry)) {
        consider(null, null);
        continue;
      }
      const candidateDates = new Set(seriesOriginDates(entry, { to: addDays(nowIso.slice(0, 10), 9) }));
      for (const exception of exceptions) if (fitsSeries(entry, exception.originDate) && exception.originDate <= entry.repeat.until) candidateDates.add(exception.originDate);
      for (const originDate of candidateDates) {
        consider(originDate, exceptionByDate.get(originDate) ?? null);
      }
    }
    candidates.sort((a, b) => {
      if (a.__dueMs !== b.__dueMs) return a.__dueMs - b.__dueMs;
      if (a.key.entryId !== b.key.entryId) return a.key.entryId < b.key.entryId ? -1 : 1;
      const left = a.key.originDate ?? "";
      const right = b.key.originDate ?? "";
      if (left === right) return 0;
      return left < right ? -1 : 1;
    });
    return candidates.map(({ __dueMs, ...rest }) => rest);
  }
  var datePattern = /^(19\d{2}|20\d{2}|2100)-\d{2}-\d{2}$/;
  var timeOfDayPattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  var placeholderId = "00000000-0000-4000-8000-000000000000";
  var id = schema.string({ pattern: uuidPattern });
  var date = schema.string({ pattern: datePattern });
  var version = schema.integer({ min: 1 });
  var timeSchema = schema.object([
    ["date", date],
    ["startTime", schema.string({ pattern: timeOfDayPattern })],
    ["timeZone", schema.string({ minLength: 1, maxLength: 100 })],
    ["durationMinutes", schema.integer({ min: 1, max: 1440 })]
  ]);
  var repeatSchema = schema.object([["until", date]]);
  var calendarSchema = schema.object([
    ["allDay", schema.boolean()],
    ["notes", schema.string({ maxLength: 5e4 })],
    ["tags", schema.array(() => id, { maxItems: 30 })]
  ]);
  var calendarRepeatSchema = schema.object([
    ["until", date],
    ["frequency", schema.string({ enum: ["daily", "weekly", "monthly", "yearly"] })],
    ["interval", schema.integer({ min: 1, max: 999 })],
    ["weekdays", schema.array(() => schema.integer({ min: 0, max: 6 }), { maxItems: 7 })],
    ["monthly", schema.string({ enum: ["date", "weekday"] })],
    ["count", schema.integer({ min: 0, max: 1e4 })]
  ]);
  function calendarFields(fields, value) {
    const extended = value && Object.hasOwn(value, "calendar");
    return fields.map(([name, node]) => {
      if (name === "repeat" && value?.repeat && Object.hasOwn(value.repeat, "frequency")) return [name, calendarRepeatSchema];
      if (name === "time" && extended) return [name, schema.object([
        ["date", date],
        ["startTime", schema.string({ pattern: timeOfDayPattern })],
        ["timeZone", schema.string({ minLength: 1, maxLength: 100 })],
        ["durationMinutes", schema.integer({ min: 1, max: 527040 })]
      ])];
      return [name, node];
    }).concat(extended ? [["calendar", calendarSchema]] : []);
  }
  var reminderFields = [
    ["side", schema.string({ enum: ["before", "after"] })],
    ["minutes", schema.integer({ min: 0, max: 10080 })]
  ];
  var reminderSchema = schema.oneOf([
    schema.object([...reminderFields, ["anchor", schema.string({ enum: ["start", "end"] })]]),
    schema.object(reminderFields)
  ]);
  var itemFields = [
    ["id", id],
    ["text", schema.string({ minLength: 1, maxLength: 4e3 })],
    ["priority", schema.string({ enum: ["low", "normal", "high"] })]
  ];
  var itemSchema = schema.oneOf([
    schema.object([...itemFields, ["completed", schema.boolean()]]),
    schema.object(itemFields)
  ]);
  var entryBodyFields = [
    ["title", schema.string({ maxLength: 300 })],
    ["items", schema.array(() => itemSchema, { maxItems: 200 })],
    ["time", timeSchema],
    ["repeat", repeatSchema],
    ["reminder", reminderSchema]
  ];
  var overrideSchema = schema.object([
    ["title", schema.string({ maxLength: 300 })],
    ["items", schema.array(() => itemSchema, { maxItems: 200 })],
    ["time", timeSchema],
    ["reminder", reminderSchema]
  ]);
  var deletionSchema = schema.object([
    ["expectedVersion", version],
    ["deleted", schema.boolean()]
  ]);
  var exceptionInputSchema = schema.oneOf([
    schema.object([
      ["expectedVersion", version],
      ["mode", schema.string({ const: "override" })],
      ["content", overrideSchema]
    ]),
    schema.object([
      ["expectedVersion", version],
      ["mode", schema.string({ const: "cancelled" })]
    ]),
    schema.object([
      ["expectedVersion", version],
      ["mode", schema.string({ const: "inherit" })]
    ])
  ]);
  var moveItemFields = [
    ["itemId", id],
    ["fromEntryId", id],
    ["fromVersion", version],
    ["toEntryId", id],
    ["toVersion", version],
    ["toIndex", schema.integer({ min: 0 })]
  ];
  var moveItemSchema = schema.object(moveItemFields);
  var settingsUpdateSchema = schema.object([
    ["timeZone", schema.string({ minLength: 1, maxLength: 100 })],
    ["expectedVersion", version]
  ]);
  var timeSentinel = { date: "1900-01-01", startTime: "00:00", timeZone: "UTC", durationMinutes: 1 };
  var repeatSentinel = { until: "1900-01-01" };
  var reminderSentinel = { side: "before", minutes: 0 };
  var entryNullables = [
    { path: ["time"], sentinel: timeSentinel },
    { path: ["repeat"], sentinel: repeatSentinel },
    { path: ["reminder"], sentinel: reminderSentinel }
  ];
  var overrideNullables = [
    { path: ["reminder"], sentinel: reminderSentinel }
  ];
  var moveNullables = [
    { path: ["toEntryId"], sentinel: placeholderId },
    { path: ["toVersion"], sentinel: 1 },
    { path: ["toOriginDate"], sentinel: "2000-01-01" }
  ];
  function atPath(object, path) {
    let current = object;
    for (const key of path.slice(0, -1)) {
      if (!current || typeof current !== "object") return null;
      current = current[key];
    }
    return current;
  }
  function applySentinels(body, nullables) {
    const pending = [];
    for (const { path, sentinel } of nullables) {
      const parent = atPath(body, path);
      const key = path[path.length - 1];
      if (parent && typeof parent === "object" && parent[key] === null) {
        parent[key] = structuredClone(sentinel);
        pending.push({ parent, key });
      }
    }
    return pending;
  }
  function restoreNulls(pending) {
    for (const { parent, key } of pending) parent[key] = null;
  }
  function prepare(body, nullables) {
    const prepared = structuredClone(body);
    const pending = applySentinels(prepared, nullables);
    return { prepared, pending };
  }
  function assertItems(items, pointer) {
    const seen = /* @__PURE__ */ new Set();
    items.forEach((item, index) => {
      const itemPointer = `${pointer}/items/${index}`;
      if (item.text.trim() === "") throw invalidInput(`${itemPointer}/text`, "out-of-range");
      if (seen.has(item.id)) throw invalidInput(`${itemPointer}/id`, "duplicate-id");
      seen.add(item.id);
    });
  }
  function assertDateFields(value, pointer) {
    if (value.time && !isDate2(value.time.date)) throw invalidInput(`${pointer}/time/date`, "out-of-range");
    if (value.repeat && !isDate2(value.repeat.until)) throw invalidInput(`${pointer}/repeat/until`, "out-of-range");
  }
  function validateEntryShape(value, pointer = "") {
    assertItems(value.items, pointer);
    assertDateFields(value, pointer);
    if (value.calendar) {
      if (new Set(value.calendar.tags).size !== value.calendar.tags.length) throw invalidInput(`${pointer}/calendar/tags`, "duplicate-id");
      if (value.calendar.allDay && value.time && (value.time.startTime !== "00:00" || value.time.durationMinutes % 1440 !== 0)) {
        throw invalidInput(`${pointer}/time`, "out-of-range");
      }
    }
    if (value.repeat?.frequency === "weekly" && value.repeat.weekdays.length === 0) throw invalidInput(`${pointer}/repeat/weekdays`, "empty-content");
    return value;
  }
  function validateCreateEntry(body) {
    const { prepared, pending } = prepare(body, entryNullables);
    const value = validateBody(schema.object(calendarFields(entryBodyFields, body)), prepared);
    restoreNulls(pending);
    return validateEntryShape(value);
  }
  function validateUpdateEntry(body) {
    const { prepared, pending } = prepare(body, entryNullables);
    const value = validateBody(schema.object([["expectedVersion", version], ...calendarFields(entryBodyFields, body)]), prepared);
    restoreNulls(pending);
    return validateEntryShape(value);
  }
  function validateDeleteEntry(body) {
    return validateBody(schema.object([["expectedVersion", version]]), body);
  }
  function validateSetDeletion(body) {
    return validateBody(deletionSchema, body);
  }
  function validateExceptionInput(body) {
    const prepared = structuredClone(body);
    const contentPending = prepared?.mode === "override" && prepared.content ? applySentinels(prepared.content, overrideNullables) : [];
    const overrideFields = entryBodyFields.filter(([name]) => name !== "repeat");
    const value = validateBody(body?.mode === "override" ? schema.object([
      ["expectedVersion", version],
      ["mode", schema.string({ const: "override" })],
      ["content", schema.object(calendarFields(overrideFields, body.content))]
    ]) : exceptionInputSchema, prepared);
    restoreNulls(contentPending);
    if (value.mode === "override") {
      if (value.content.time === null) throw invalidInput("/content/time", "invalid-type");
      validateEntryShape(value.content, "/content");
    }
    return value;
  }
  function validateMoveItem(body) {
    const { prepared, pending } = prepare(body, moveNullables);
    const fields = body && typeof body === "object" && ("toScope" in body || "toOriginDate" in body) ? schema.object([
      ...moveItemFields,
      ["toScope", schema.string({ enum: ["series", "instance"] })],
      ["toOriginDate", date]
    ]) : moveItemSchema;
    const value = validateBody(fields, prepared);
    restoreNulls(pending);
    return value;
  }
  function validateSettingsUpdate(body) {
    return validateBody(settingsUpdateSchema, body);
  }
  var labelFields = [
    ["name", schema.string({ minLength: 1, maxLength: 60, nonBlank: true })],
    ["color", schema.string({ pattern: /^#[0-9a-fA-F]{6}$/ })]
  ];
  var validateCreateLabel = (body) => validateBody(schema.object(labelFields), body);
  var validateUpdateLabel = (body) => validateBody(schema.object([
    ["expectedVersion", version],
    ...labelFields,
    ["deleted", schema.boolean()]
  ]), body);
  var DEFAULT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  function randomUuid() {
    return globalThis.crypto.randomUUID();
  }
  function sameReminder(left, right) {
    if (!left || !right) return left === right;
    return left.side === right.side && left.minutes === right.minutes && (left.anchor ?? "end") === (right.anchor ?? "end");
  }
  function sameTime(left, right) {
    if (!left || !right) return left === right;
    return left.date === right.date && left.startTime === right.startTime && left.timeZone === right.timeZone && left.durationMinutes === right.durationMinutes;
  }
  function normalizeContent(value) {
    const repeat2 = value.repeat ?? null;
    return {
      title: value.title,
      items: value.items.map((item) => ({
        id: item.id,
        text: item.text,
        priority: item.priority,
        ...Object.hasOwn(item, "completed") ? { completed: item.completed } : {}
      })),
      time: value.time === null ? null : { ...value.time },
      repeat: repeat2 === null ? null : { ...repeat2 },
      ...value.calendar ? { calendar: structuredClone(value.calendar) } : {},
      reminder: value.reminder === null ? null : { side: value.reminder.side, minutes: value.reminder.minutes, ...value.reminder.anchor ? { anchor: value.reminder.anchor } : {} }
    };
  }
  function overrideView(content) {
    return {
      title: content.title,
      items: content.items,
      time: content.time,
      reminder: content.reminder,
      ...content.calendar ? { calendar: content.calendar } : {}
    };
  }
  function parseNow(clock) {
    const value = clock.now();
    const ms = value instanceof Date ? value.getTime() : parseInstant(String(value));
    if (Number.isNaN(ms)) throw new Error("Schedule clock returned an invalid instant.");
    return { ms, iso: formatIsoZ(ms) };
  }
  function createScheduleService({ repository, beforeChange, clock }) {
    if (!repository) throw new TypeError("createScheduleService requires a repository.");
    if (typeof beforeChange !== "function") {
      throw new TypeError("createScheduleService requires a synchronous beforeChange seam.");
    }
    if (!clock || typeof clock.now !== "function") {
      throw new TypeError("createScheduleService requires a clock.");
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
    function readEntryOrThrow(principal, id2) {
      const entry = repository.findEntry(principal.accountKey, id2);
      if (!entry) throw contractError(problems.notFound());
      return entry;
    }
    function readActiveEntry(principal, id2) {
      const entry = readEntryOrThrow(principal, id2);
      if (entry.deletedAt) throw contractError(problems.objectDeleted());
      return entry;
    }
    function assertVersion(entry, expectedVersion) {
      if (entry.version !== expectedVersion) {
        throw scheduleProblems.versionConflict(entry.id, entry.version);
      }
    }
    function assertContentRules(content) {
      if (content.title.trim() === "" && content.items.length === 0) {
        throw invalidInput("/title", "empty-content");
      }
      if (content.time === null) {
        if (content.repeat !== null) throw invalidInput("/repeat", "invalid-type");
        if (content.reminder !== null) throw invalidInput("/reminder", "invalid-type");
      } else {
        if (!isTimeZone(content.time.timeZone)) throw scheduleProblems.invalidTimeZone("/time/timeZone");
        if (!isTimeOfDay(content.time.startTime)) throw invalidInput("/time/startTime", "out-of-range");
        if (content.repeat !== null && compareDates(content.repeat.until, content.time.date) < 0) {
          throw invalidInput("/repeat/until", "out-of-range");
        }
      }
    }
    function dueFor(content, originDate) {
      const placed = originDate === null || !content.time ? content : { ...content, time: { ...content.time, date: originDate } };
      return dueInstantMs(placed);
    }
    function assertReminderFuture(content, previous, nowMs, { repeatingTemplate }) {
      if (content.reminder === null || content.time === null) return;
      const unchanged = previous && sameReminder(previous.reminder, content.reminder) && sameTime(previous.time, content.time) && (previous.repeat?.until ?? null) === (content.repeat?.until ?? null);
      if (unchanged) return;
      if (repeatingTemplate) {
        const hasFuture = seriesOriginDates({ time: content.time, repeat: content.repeat }).some((originDate) => {
          const dueMs2 = dueFor(content, originDate);
          return dueMs2 !== null && dueMs2 > nowMs;
        });
        if (!hasFuture) throw scheduleProblems.reminderNotFuture("/reminder");
        return;
      }
      const dueMs = dueFor(content, null);
      if (dueMs === null) return;
      const previousDue = previous && previous.reminder && previous.time ? dueFor(previous, null) : null;
      const changed = !previous || !sameReminder(previous.reminder, content.reminder) || previousDue !== dueMs;
      if (changed && dueMs <= nowMs) throw scheduleProblems.reminderNotFuture("/reminder");
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
        reminder: entry.reminder,
        calendar: entry.calendar ?? { allDay: false, notes: "", tags: [] }
      };
    }
    function occurrenceView(principal, occurrence) {
      const view = stripInternal(occurrence);
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
        exception
      });
    }
    function writeArmsForNewlyVisible(entry, previousUntil, nowIso) {
      for (const originDate of seriesOriginDates(entry)) {
        if (compareDates(originDate, previousUntil) > 0) {
          repository.writeArm({ entryId: entry.id, originDate, armedAt: nowIso });
        }
      }
    }
    function insertEntry(principal, content, now) {
      const entry = {
        id: randomUuid(),
        accountKey: principal.accountKey,
        version: 1,
        title: content.title,
        items: content.items,
        time: content.time,
        repeat: content.repeat,
        calendar: content.calendar ?? { allDay: false, notes: "", tags: [] },
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
          entries: repository.listEntries(principal.accountKey).map((entry) => ({
            entry: entryView(principal, entry),
            exceptions: repository.listExceptions(entry.id)
          })),
          settings: settings ? { timeZone: settings.timeZone, version: settings.version } : null
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
      updateLabel(principal, id2, body) {
        const label = repository.findLabel(principal.accountKey, id2);
        if (!label) throw contractError(problems.notFound());
        assertVersion(label, body.expectedVersion);
        const updated = {
          ...label,
          accountKey: principal.accountKey,
          name: body.name.trim(),
          color: body.color,
          version: label.version + 1,
          deleted: body.deleted ? 1 : 0
        };
        repository.writeLabel(updated);
        return { id: id2, name: updated.name, color: updated.color, version: updated.version, deleted: Boolean(updated.deleted) };
      },
      getSettings(principal) {
        const row = readSettings(principal.accountKey);
        return { timeZone: row.timeZone, version: row.version };
      },
      updateSettings(principal, body) {
        if (!isTimeZone(body.timeZone)) throw scheduleProblems.invalidTimeZone("/timeZone");
        const row = readSettings(principal.accountKey);
        if (row.version !== body.expectedVersion) throw contractError(problems.versionConflict(row.version));
        const entries = repository.listEntries(principal.accountKey);
        const needsUpdate = entries.some((entry) => entry.time && (entry.time.timeZone !== body.timeZone || repository.listExceptions(entry.id).some((exception) => exception.content?.time && exception.content.time.timeZone !== body.timeZone)));
        if (row.timeZone === body.timeZone && !needsUpdate) return { timeZone: row.timeZone, version: row.version };
        const now = nowStamp();
        beforeChange(principal, now);
        for (const entry of entries) {
          if (!entry.time) continue;
          const exceptions = repository.listExceptions(entry.id);
          if (entry.time.timeZone === body.timeZone && !exceptions.some((exception) => exception.content?.time && exception.content.time.timeZone !== body.timeZone)) continue;
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
        const state = query.state ?? "active";
        const placement = query.placement ?? "all";
        return {
          items: repository.listEntries(principal.accountKey).filter((entry) => state === "deleted" ? entry.deletedAt !== null : entry.deletedAt === null).filter((entry) => placement === "unscheduled" ? entry.time === null : true).map((entry) => entryView(principal, entry))
        };
      },
      getEntry(principal, id2) {
        return entryView(principal, readEntryOrThrow(principal, id2));
      },
      createEntry(principal, body) {
        const content = normalizeContent(body);
        const repeatingTemplate = content.repeat !== null;
        assertContentRules(content);
        const now = parseNow(clock);
        assertReminderFuture(content, null, now.ms, { repeatingTemplate });
        beforeChange(principal, now.iso);
        const entry = insertEntry(principal, content, now);
        return entryView(principal, entry);
      },
      updateEntry(principal, id2, body) {
        const entry = readActiveEntry(principal, id2);
        assertVersion(entry, body.expectedVersion);
        const content = normalizeContent(body);
        if (entry.repeat?.frequency && body.repeat && !body.repeat.frequency) content.repeat = { ...entry.repeat, until: body.repeat.until };
        const repeatingTemplate = content.repeat !== null;
        assertContentRules(content);
        if (!body.calendar && isRepeating(entry)) {
          if (content.repeat === null || content.time === null) throw scheduleProblems.immutableSeries();
          if (content.time.date !== entry.time.date || content.time.timeZone !== entry.time.timeZone) {
            throw scheduleProblems.immutableSeries();
          }
        } else if (!body.calendar && content.repeat !== null) {
          throw scheduleProblems.immutableSeries();
        }
        const now = parseNow(clock);
        const previousContent = { ...templateContent(entry), repeat: entry.repeat };
        assertReminderFuture(content, previousContent, now.ms, { repeatingTemplate });
        const timingChanged = !sameTime(previousContent.time, content.time) || JSON.stringify(previousContent.repeat) !== JSON.stringify(content.repeat) || !sameReminder(previousContent.reminder, content.reminder);
        beforeChange(principal, now.iso);
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
          reminder: content.reminder,
          reminderArmedAt: timingChanged ? now.iso : entry.reminderArmedAt,
          updatedAt: now.iso,
          deletedAt: null
        };
        repository.writeEntry(updated);
        return entryView(principal, updated);
      },
      deleteEntry(principal, id2, body) {
        const entry = readEntryOrThrow(principal, id2);
        assertVersion(entry, body.expectedVersion);
        beforeChange(principal, parseNow(clock).iso);
        repository.deleteEntry(principal.accountKey, entry.id);
        return { id: entry.id, version: entry.version + 1 };
      },
      setEntryDeletion(principal, id2, body) {
        const entry = readEntryOrThrow(principal, id2);
        assertVersion(entry, body.expectedVersion);
        const now = parseNow(clock);
        beforeChange(principal, now.iso);
        if (body.deleted) {
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
      listExceptions(principal, id2) {
        const entry = readEntryOrThrow(principal, id2);
        const items = repository.listExceptions(entry.id).map((exception) => ({
          originDate: exception.originDate,
          mode: exception.mode,
          eligible: isRepeating(entry) ? compareDates(exception.originDate, entry.repeat.until) <= 0 : false,
          content: exception.mode === "override" && exception.content ? overrideView(exception.content) : null
        }));
        return { entryId: entry.id, version: entry.version, items };
      },
      detachOccurrence(principal, id2, originDate, body) {
        if (!isDate2(originDate)) throw invalidInput("/originDate", "out-of-range");
        const entry = readActiveEntry(principal, id2);
        if (!isRepeating(entry) || !fitsSeries(entry, originDate) || compareDates(originDate, entry.repeat.until) > 0) throw contractError(problems.notFound());
        assertVersion(entry, body.expectedVersion);
        const existing = repository.findException(id2, originDate);
        if (existing?.mode === "cancelled") throw contractError(problems.notFound());
        const previous = existing?.mode === "override" && existing.content ? existing.content : effectiveContent(entry, null, originDate);
        const content = normalizeContent(body);
        if (content.repeat !== null) throw invalidInput("/repeat", "out-of-range");
        assertContentRules(content);
        const now = parseNow(clock);
        assertReminderFuture(content, previous, now.ms, { repeatingTemplate: false });
        beforeChange(principal, now.iso);
        repository.writeException({ entryId: id2, originDate, mode: "cancelled", content: null, now: now.iso });
        repository.writeArm({ entryId: id2, originDate, armedAt: now.iso });
        repository.writeEntry({ ...entry, version: entry.version + 1, updatedAt: now.iso });
        return entryView(principal, insertEntry(principal, content, now));
      },
      setException(principal, id2, originDate, body) {
        if (!isDate2(originDate)) throw invalidInput("/originDate", "out-of-range");
        const entry = readActiveEntry(principal, id2);
        if (!isRepeating(entry)) throw contractError(problems.notFound());
        if (!fitsSeries(entry, originDate)) throw contractError(problems.notFound());
        if (compareDates(originDate, entry.repeat.until) > 0) {
          throw invalidInput("/originDate", "out-of-range");
        }
        assertVersion(entry, body.expectedVersion);
        const now = parseNow(clock);
        const existing = repository.findException(entry.id, originDate);
        const previousContent = existing?.mode === "override" && existing.content ? existing.content : effectiveContent(entry, null, originDate);
        if (body.mode === "override") {
          const content = normalizeContent(body.content);
          assertContentRules(content);
          assertReminderFuture(content, previousContent, now.ms, { repeatingTemplate: false });
          beforeChange(principal, now.iso);
          repository.writeException({
            entryId: entry.id,
            originDate,
            mode: "override",
            content: { ...content, calendar: content.calendar ?? previousContent.calendar },
            now: now.iso
          });
          if (!sameTime(previousContent.time, content.time) || !sameReminder(previousContent.reminder, content.reminder)) {
            repository.writeArm({ entryId: entry.id, originDate, armedAt: now.iso });
          }
        } else if (body.mode === "cancelled") {
          beforeChange(principal, now.iso);
          repository.writeException({ entryId: entry.id, originDate, mode: "cancelled", content: null, now: now.iso });
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
      getOccurrence(principal, id2, query) {
        const entry = readEntryOrThrow(principal, id2);
        const originDate = query.originDate ?? null;
        if (!isRepeating(entry)) {
          if (originDate !== null) throw invalidInput("/query/originDate", "out-of-range");
          if (entry.time === null) throw contractError(problems.notFound());
        } else {
          if (originDate === null) throw invalidInput("/query/originDate", "required");
          if (!isDate2(originDate) || !fitsSeries(entry, originDate)) throw contractError(problems.notFound());
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
              exception: null
            });
            if (intersects(occurrence, start, end)) items.push(occurrence);
            continue;
          }
          const origins = new Set(seriesOriginDates(entry, {
            from: addDays(query.from, -Math.ceil(entry.time.durationMinutes / 1440) - 2),
            to: addDays(query.to, 2)
          }));
          for (const originDate of byDate.keys()) {
            if (originDate <= entry.repeat.until && fitsSeries(entry, originDate)) origins.add(originDate);
          }
          for (const originDate of origins) {
            const exception = byDate.get(originDate) ?? null;
            const occurrence = buildOccurrence({
              entry,
              originDate,
              exception
            });
            if (occurrence.state !== "active") continue;
            if (intersects(occurrence, start, end)) items.push(occurrence);
          }
        }
        sortOccurrences(items);
        return { timeZone: settings.timeZone, items: items.map((item) => occurrenceView(principal, item)) };
      },
      moveItem(principal, body) {
        const from = readActiveEntry(principal, body.fromEntryId);
        if (isRepeating(from)) throw scheduleProblems.invalidMove();
        const itemIndex = from.items.findIndex((item2) => item2.id === body.itemId);
        if (itemIndex < 0) throw invalidInput("/itemId", "invalid-reference");
        if (from.version !== body.fromVersion) {
          throw scheduleProblems.versionConflict(from.id, from.version);
        }
        const now = parseNow(clock);
        const item = from.items[itemIndex];
        let target;
        let detached = false;
        let targetOriginDate = null;
        if (body.toEntryId === null) {
          if (body.toScope !== void 0) throw scheduleProblems.invalidMove();
          if (body.toVersion !== null) throw invalidInput("/toVersion", "out-of-range");
          if (body.toIndex !== 0) throw invalidInput("/toIndex", "out-of-range");
          target = {
            id: randomUuid(),
            accountKey: principal.accountKey,
            version: 1,
            title: "",
            items: [item],
            time: null,
            repeat: null,
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
          if (repeating && !body.toScope || !repeating && body.toScope !== void 0) throw scheduleProblems.invalidMove();
          if (body.toScope === "series" && body.toOriginDate !== null) throw invalidInput("/toOriginDate", "out-of-range");
          if (body.toVersion === null) throw invalidInput("/toVersion", "required");
          if (existing.version !== body.toVersion) {
            throw scheduleProblems.versionConflict(existing.id, existing.version);
          }
          let content = normalizeContent(existing);
          if (body.toScope === "instance") {
            const origin = body.toOriginDate;
            if (!isDate2(origin)) throw invalidInput("/toOriginDate", "out-of-range");
            if (!fitsSeries(existing, origin)) throw scheduleProblems.invalidMove();
            const occurrence = occurrenceFor(principal, existing, origin);
            if (occurrence.state !== "active") throw scheduleProblems.invalidMove();
            content = normalizeContent(effectiveContent(existing, repository.findException(existing.id, origin), origin));
          }
          if (content.items.length >= 200) throw invalidInput("/toIndex", "out-of-range");
          if (content.items.some((candidate) => candidate.id === item.id)) throw invalidInput("/itemId", "duplicate-id");
          if (body.toIndex > content.items.length) throw invalidInput("/toIndex", "out-of-range");
          const items = [...content.items];
          items.splice(body.toIndex, 0, item);
          if (body.toScope === "instance") {
            const result = this.detachOccurrence(principal, existing.id, body.toOriginDate, {
              ...content,
              items,
              repeat: null,
              expectedVersion: existing.version
            });
            target = readActiveEntry(principal, result.id);
            detached = true;
          } else {
            target = { ...existing, version: existing.version + 1, items, updatedAt: now.iso };
            assertContentRules(normalizeContent(target), { repeatingTemplate: repeating });
            if (repeating) {
              const dates = seriesOriginDates(target).filter((date2) => !repository.findException(target.id, date2));
              const today = localPartsAt(target.time.timeZone, now.ms).date;
              targetOriginDate = dates.find((date2) => date2 >= today) ?? dates[0] ?? null;
            }
          }
        }
        if (!detached) {
          beforeChange(principal, now.iso);
          if (body.toEntryId === null) repository.insertEntry(target);
          else repository.writeEntry(target);
        }
        const remaining = from.items.filter((candidate) => candidate.id !== item.id);
        const keepSource = from.title.trim() !== "" || remaining.length > 0;
        const source = {
          ...from,
          version: from.version + 1,
          items: remaining,
          updatedAt: now.iso,
          deletedAt: keepSource ? from.deletedAt : now.iso
        };
        repository.writeEntry(source);
        return { from: entryView(principal, source), to: entryView(principal, target), ...body.toScope ? { toOriginDate: targetOriginDate } : {} };
      },
      /** Public port: `schedule.readOccurrence(principal, {entryId, originDate})`. */
      readOccurrence(principal, { entryId, originDate = null } = {}) {
        const entry = readEntryOrThrow(principal, entryId);
        if (!isRepeating(entry)) {
          if (entry.time === null) throw contractError(problems.notFound());
          if (originDate !== null) throw contractError(problems.notFound());
        } else if (originDate === null || !isDate2(originDate) || !fitsSeries(entry, originDate)) {
          throw contractError(problems.notFound());
        }
        return occurrenceView(principal, occurrenceFor(principal, entry, originDate));
      },
      /** Public port: reminder candidates only; never writes a notification. */
      listReminderCandidates(principal, now) {
        const nowMs = now instanceof Date ? now.getTime() : parseInstant(String(now));
        if (Number.isNaN(nowMs)) throw new Error("listReminderCandidates requires a valid server instant.");
        const nowIso = formatIsoZ(nowMs);
        const entries = repository.listEntries(principal.accountKey);
        const exceptionsByEntry = /* @__PURE__ */ new Map();
        const armsByEntry = /* @__PURE__ */ new Map();
        for (const entry of entries) {
          exceptionsByEntry.set(entry.id, repository.listExceptions(entry.id));
          armsByEntry.set(entry.id, new Map(repository.listArms(entry.id).map((arm) => [arm.originDate, arm])));
        }
        return listReminderCandidates(entries, exceptionsByEntry, armsByEntry, nowIso);
      }
    };
  }
  function memoryRepository(state) {
    const clone2 = (value) => value == null ? null : structuredClone(value);
    const key = (entryId, originDate) => `${entryId}:${originDate ?? ""}`;
    return {
      readSettings: () => clone2(state.settings),
      insertSettings: (row) => {
        state.settings = clone2(row);
      },
      writeSettings: (row) => {
        state.settings = { ...state.settings, ...clone2(row) };
      },
      listEntries: () => Object.values(state.entries).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).map(clone2),
      findEntry: (_, id2) => clone2(state.entries[id2]),
      insertEntry: (entry) => {
        state.entries[entry.id] = clone2(entry);
      },
      writeEntry: (entry) => {
        state.entries[entry.id] = clone2(entry);
      },
      deleteEntry(_, id2) {
        delete state.entries[id2];
        this.clearSeries(id2);
      },
      listLabels: () => Object.values(state.labels).filter((row) => !row.deleted).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map(({ id: id2, name, color, version: version2 }) => ({ id: id2, name, color, version: version2 })),
      findLabel: (_, id2) => clone2(state.labels[id2]),
      insertLabel: (label) => {
        state.labels[label.id] = { ...clone2(label), version: 1, deleted: 0 };
      },
      writeLabel: (label) => {
        state.labels[label.id] = clone2(label);
      },
      listExceptions: (id2) => Object.values(state.exceptions).filter((row) => row.entryId === id2).sort((a, b) => a.originDate.localeCompare(b.originDate)).map(clone2),
      findException: (id2, date2) => clone2(state.exceptions[key(id2, date2)]),
      writeException({ entryId, originDate, mode, content, now }) {
        const rowKey = key(entryId, originDate);
        state.exceptions[rowKey] = { entryId, originDate, mode, content: clone2(content), createdAt: state.exceptions[rowKey]?.createdAt ?? now, updatedAt: now };
      },
      removeException: (id2, date2) => {
        delete state.exceptions[key(id2, date2)];
      },
      clearSeries(id2) {
        for (const [rowKey, row] of Object.entries(state.exceptions)) if (row.entryId === id2) delete state.exceptions[rowKey];
        for (const [rowKey, row] of Object.entries(state.arms)) if (row.entryId === id2) delete state.arms[rowKey];
      },
      listArms: (id2) => Object.values(state.arms).filter((row) => row.entryId === id2).map(clone2),
      findArm: (id2, date2) => clone2(state.arms[key(id2, date2)]),
      writeArm: (row) => {
        state.arms[key(row.entryId, row.originDate)] = clone2(row);
      },
      removeArm: (id2, date2) => {
        delete state.arms[key(id2, date2)];
      }
    };
  }
  async function handleSchedule(req, ctx) {
    const prefix = "/api/modules/schedule";
    if (req.path !== prefix && !req.path.startsWith(`${prefix}/`)) return void 0;
    const state = ctx.state.schedule ??= { entries: {}, exceptions: {}, arms: {}, labels: {}, settings: null, notifications: {}, receipts: {} };
    const repository = memoryRepository(state);
    const principal = { accountKey: "prototype" };
    const now = () => {
      const value = ctx.now();
      return value instanceof Date ? value.toISOString() : typeof value === "number" ? new Date(value).toISOString() : String(value);
    };
    let service;
    const captureDue = (_, stamp) => {
      for (const candidate of service.listReminderCandidates(principal, stamp)) {
        const exists = Object.values(state.notifications).some((row) => row.key.entryId === candidate.key.entryId && row.key.originDate === candidate.key.originDate);
        if (!exists) {
          const id2 = ctx.id();
          state.notifications[id2] = { id: id2, key: candidate.key, title: candidate.title, dueAt: candidate.dueAt, readAt: null, dismissedAt: null };
        }
      }
    };
    service = createScheduleService({ repository, beforeChange: captureDue, clock: { now } });
    const path = req.path.slice(prefix.length);
    const method = req.method.toUpperCase();
    const body = req.body;
    const query = {};
    for (const [name, value] of req.url.searchParams) query[name] = name in query ? [query[name], value] : value;
    const validateQuery = (allowed) => {
      for (const name of Object.keys(query).sort()) {
        if (!allowed.includes(name)) throw invalidInput(`/query/${name}`, "unknown-field");
        if (typeof query[name] !== "string") throw invalidInput(`/query/${name}`, "duplicate-id");
      }
    };
    const requiredDate = (name) => {
      if (query[name] === void 0) throw invalidInput(`/query/${name}`, "required");
      if (!isDate2(query[name])) throw invalidInput(`/query/${name}`, "out-of-range");
      return query[name];
    };
    const checked = (validate, action) => {
      validate(body);
      return action();
    };
    const notificationChange = (ids) => {
      if (!["read", "unread", "dismiss"].includes(body?.action)) throw invalidInput("/action", "out-of-range");
      if (!Array.isArray(ids) || !ids.length) throw invalidInput("/ids", "out-of-range");
      const stamp = now();
      captureDue(principal, stamp);
      for (const id2 of ids) if (!state.notifications[id2]) throw contractError(problems.notFound());
      return ids.map((id2) => {
        const row = state.notifications[id2];
        if (body.action === "unread") row.readAt = null;
        else if (body.action === "read") row.readAt ??= stamp;
        else row.dismissedAt ??= stamp;
        return structuredClone(row);
      });
    };
    const snapshot = method === "GET" ? null : structuredClone(state);
    const receiptKey = req.headers.get("Idempotency-Key");
    const fingerprint = JSON.stringify([method, req.path, body]);
    try {
      if (method !== "GET" && receiptKey && state.receipts[receiptKey]) {
        const receipt = state.receipts[receiptKey];
        if (receipt.fingerprint !== fingerprint) throw contractError(problems.idempotencyKeyReused());
        return ctx.json(receipt.body, receipt.status);
      }
      let result;
      let status = 200;
      if (path === "/settings") {
        validateQuery([]);
        if (method === "GET") result = service.getSettings(principal);
        else if (method === "PUT") result = checked(validateSettingsUpdate, () => service.updateSettings(principal, body));
      } else if (path === "/labels") {
        validateQuery([]);
        if (method === "GET") result = service.listLabels(principal);
        else if (method === "POST") {
          result = checked(validateCreateLabel, () => service.createLabel(principal, body));
          status = 201;
        }
      } else if (/^\/labels\/[^/]+$/.test(path)) {
        const id2 = path.split("/")[2];
        validateIdPath(id2);
        validateQuery([]);
        if (method === "PUT") result = checked(validateUpdateLabel, () => service.updateLabel(principal, id2, body));
      } else if (path === "/entries") {
        if (method === "GET") {
          validateQuery(["state", "placement"]);
          if (query.state && !["active", "deleted"].includes(query.state)) throw invalidInput("/query/state", "out-of-range");
          if (query.placement && !["all", "unscheduled"].includes(query.placement)) throw invalidInput("/query/placement", "out-of-range");
          result = service.listEntries(principal, query);
        } else if (method === "POST") {
          validateQuery([]);
          result = checked(validateCreateEntry, () => service.createEntry(principal, body));
          status = 201;
        }
      } else if (path.startsWith("/entries/")) {
        const [, , id2, action, date2, tail] = path.split("/");
        validateIdPath(id2);
        if (!action) {
          validateQuery([]);
          if (method === "GET") result = service.getEntry(principal, id2);
          else if (method === "PUT") result = checked(validateUpdateEntry, () => service.updateEntry(principal, id2, body));
        } else if (action === "delete" && method === "POST") {
          validateQuery([]);
          result = checked(validateDeleteEntry, () => service.deleteEntry(principal, id2, body));
        } else if (action === "deletion" && method === "POST") {
          validateQuery([]);
          result = checked(validateSetDeletion, () => service.setEntryDeletion(principal, id2, body));
        } else if (action === "exceptions") {
          validateQuery([]);
          if (!date2 && method === "GET") result = service.listExceptions(principal, id2);
          else if (date2 && method === "PUT") result = checked(validateExceptionInput, () => service.setException(principal, id2, date2, body));
        } else if (action === "occurrences" && date2 && tail === "detach" && method === "POST") {
          validateQuery([]);
          result = checked(validateUpdateEntry, () => service.detachOccurrence(principal, id2, date2, body));
          status = 201;
        } else if (action === "occurrence" && method === "GET") {
          validateQuery(["originDate"]);
          if (query.originDate !== void 0 && !isDate2(query.originDate)) throw invalidInput("/query/originDate", "out-of-range");
          result = service.getOccurrence(principal, id2, query);
        }
      } else if (path === "/occurrences" && method === "GET") {
        validateQuery(["from", "to"]);
        const from = requiredDate("from");
        const to = requiredDate("to");
        if (from > to) throw invalidInput("/query/from", "out-of-range");
        result = service.listOccurrences(principal, { from, to });
      } else if (path === "/item-moves" && method === "POST") {
        validateQuery([]);
        result = checked(validateMoveItem, () => service.moveItem(principal, body));
      } else if (path === "/notifications" && method === "GET") {
        validateQuery([]);
        captureDue(principal, now());
        const items = Object.values(state.notifications).filter((row) => !row.dismissedAt).sort((a, b) => b.dueAt.localeCompare(a.dueAt) || a.id.localeCompare(b.id));
        result = { items, unreadCount: items.filter((row) => !row.readAt).length };
      } else if (/^\/notifications\/[^/]+$/.test(path) && method === "POST") {
        validateQuery([]);
        result = notificationChange([path.split("/")[2]])[0];
      } else if (path === "/notification-actions" && method === "POST") {
        validateQuery([]);
        result = { items: notificationChange(body?.ids) };
      }
      if (result === void 0) throw contractError(problems.notFound());
      if (method !== "GET" && receiptKey) state.receipts[receiptKey] = { fingerprint, body: structuredClone(result), status };
      return ctx.json(result, status);
    } catch (error) {
      if (snapshot) {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, snapshot);
      }
      if (error.problem) return ctx.problem(error.problem.type, error.status, error.problem);
      throw error;
    }
  }
  return __toCommonJS(schedule_exports);
})();
