import {
  PRIORITY_LEVELS,
  timezoneToUtc,
  getNextSaturdayDate,
  isValidDateString,
  parseDateResponse,
} from "../../backend/utils/date.js";

describe("date utilities", () => {
  describe("PRIORITY_LEVELS", () => {
    it("should contain community priority levels p1, p2, p3", () => {
      expect(PRIORITY_LEVELS).toContain("p1");
      expect(PRIORITY_LEVELS).toContain("p2");
      expect(PRIORITY_LEVELS).toContain("p3");
    });

    it("should contain repurposed priority levels r1, r2, r3", () => {
      expect(PRIORITY_LEVELS).toContain("r1");
      expect(PRIORITY_LEVELS).toContain("r2");
      expect(PRIORITY_LEVELS).toContain("r3");
    });

    it("should have exactly 6 priority levels", () => {
      expect(PRIORITY_LEVELS).toHaveLength(6);
    });
  });

  describe("timezoneToUtc", () => {
    it("should return undefined for date string without timezone", () => {
      const result = timezoneToUtc("2024-01-01 12:00");
      expect(result).toBeUndefined();
    });

    it("should convert PST date to UTC", () => {
      const result = timezoneToUtc("2024-01-15 12:00 PST");
      expect(result).toBeInstanceOf(Date);
      expect(result).toBeDefined();
    });

    it("should convert EST date to UTC", () => {
      const result = timezoneToUtc("2024-01-15 12:00 EST");
      expect(result).toBeInstanceOf(Date);
      expect(result).toBeDefined();
    });

    it("should return undefined for unsupported IANA timezone names", () => {
      // timezoneToUtc only supports 3-4 letter timezone abbreviations (PST, EST, etc.)
      // Full IANA names like America/Los_Angeles are not supported
      const result = timezoneToUtc("2024-01-15 12:00 America/Los_Angeles");
      expect(result).toBeUndefined();
    });

    it("should return undefined for invalid date string", () => {
      const result = timezoneToUtc("invalid-date PST");
      expect(result).toBeUndefined();
    });
  });

  describe("getNextSaturdayDate", () => {
    it("should return a Date object", () => {
      const result = getNextSaturdayDate();
      expect(result).toBeInstanceOf(Date);
    });

    it("should return a valid date", () => {
      const result = getNextSaturdayDate();
      expect(result.getTime()).not.toBeNaN();
    });

    it("should accept custom hour and minute", () => {
      const result = getNextSaturdayDate(14, 30);
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("isValidDateString", () => {
    it("should return true for valid date string format", () => {
      const result = isValidDateString("01/15/2024 12:00 PM PST");
      expect(result).toBe(true);
    });

    it("should return true for valid date without timezone", () => {
      const result = isValidDateString("01/15/2024 12:00 PM");
      expect(result).toBe(true);
    });

    it("should return false for invalid date format", () => {
      const result = isValidDateString("2024-01-15 12:00");
      expect(result).toBe(false);
    });

    it("should return false for completely invalid string", () => {
      const result = isValidDateString("not a date");
      expect(result).toBe(false);
    });
  });

  describe("parseDateResponse", () => {
    it("should return priority level for p1", () => {
      const result = parseDateResponse("p1");
      expect(result).toBe("p1");
    });

    it("should return priority level for P2 (case insensitive)", () => {
      const result = parseDateResponse("P2");
      expect(result).toBe("p2");
    });

    it("should return priority level for r1", () => {
      const result = parseDateResponse("r1");
      expect(result).toBe("r1");
    });

    it("should handle whitespace around priority levels", () => {
      const result = parseDateResponse("  p3  ");
      expect(result).toBe("p3");
    });

    it("should return undefined for invalid date string", () => {
      const result = parseDateResponse("invalid date");
      expect(result).toBeUndefined();
    });

    it("should return Date for valid date string", () => {
      const result = parseDateResponse("01/15/2024 12:00 PM PST");
      expect(result).toBeInstanceOf(Date);
    });
  });
});
