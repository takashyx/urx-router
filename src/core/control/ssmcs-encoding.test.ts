// SSMCS (Sweet Spot Morphing Channel Strip) raw→display encoding tests. The plan
// stores raw broker integers for the morphing strip and the inspector turns them
// into the device LCD units through these curves (vd.ts). The translate / readback
// round-trip suites move the RAW values through the device, so they never exercise
// the display curves themselves — a regression in a curve would silently mislabel
// the inspector while every round-trip stayed green. These pin the live-calibration
// anchors (endpoints exact, interior points to the LCD precision) documented in
// vd.ts, mirroring the calibration-anchor style of fx-effect.test.ts.

import { describe, expect, it } from "vitest";
import {
  ssmcsCompDrive,
  ssmcsAttackMs,
  ssmcsReleaseMs,
  ssmcsQ,
  ssmcsFreqHz,
  ssmcsGainDb,
  ssmcsRatio,
  sweetSpotDataToStr,
  strToSweetSpotData,
  SSMCS_FREQ_RAW_MIN,
  SSMCS_FREQ_RAW_MAX,
  SSMCS_Q_RAW_MIN,
  SSMCS_Q_RAW_MAX,
  SSMCS_GAIN_MIN,
  SSMCS_GAIN_MAX,
  SSMCS_ATTACK_RAW_MIN,
  SSMCS_ATTACK_RAW_MAX,
  SSMCS_RELEASE_RAW_MIN,
  SSMCS_RELEASE_RAW_MAX,
  SSMCS_COMP_DRIVE_MIN,
  SSMCS_COMP_DRIVE_MAX,
  SSMCS_RATIO_RAW_MAX,
  SWEET_SPOT_DATA_MAX,
} from "./vd";

describe("SSMCS raw→display encodings (live LCD calibration)", () => {
  it("EQ/SC frequency = 20 × 10^((raw−4)/40): 20 Hz … 20 kHz, 1/12-oct", () => {
    expect(ssmcsFreqHz(SSMCS_FREQ_RAW_MIN)).toBeCloseTo(20, 5); // raw 4 = 20 Hz
    expect(ssmcsFreqHz(SSMCS_FREQ_RAW_MAX)).toBeCloseTo(20000, 5); // raw 124 = 20 kHz
    expect(ssmcsFreqHz(44)).toBeCloseTo(200, 5); // one decade up
    expect(ssmcsFreqHz(84)).toBeCloseTo(2000, 5); // two decades up
  });

  it("EQ/SC Q = 0.5 × 32^(raw/60): 0.50 … 16.0 logarithmic", () => {
    expect(ssmcsQ(SSMCS_Q_RAW_MIN)).toBeCloseTo(0.5, 5); // raw 0 = 0.50
    expect(ssmcsQ(SSMCS_Q_RAW_MAX)).toBeCloseTo(16, 5); // raw 60 = 16.0
    expect(ssmcsQ(30)).toBeCloseTo(2.828, 2); // geometric midpoint
  });

  it("EQ/SC/Out gain = (raw−180)/10 dB: ±18 dB, raw 180 = 0 dB", () => {
    expect(ssmcsGainDb(180)).toBe(0);
    expect(ssmcsGainDb(SSMCS_GAIN_MIN)).toBe(-18); // raw 0
    expect(ssmcsGainDb(SSMCS_GAIN_MAX)).toBe(18); // raw 360
    expect(ssmcsGainDb(90)).toBe(-9); // linear
  });

  it("Comp Drive = raw/20: 0.00 … 10.00", () => {
    expect(ssmcsCompDrive(SSMCS_COMP_DRIVE_MIN)).toBe(0);
    expect(ssmcsCompDrive(SSMCS_COMP_DRIVE_MAX)).toBe(10); // raw 200 = 10.00
    expect(ssmcsCompDrive(100)).toBe(5);
  });

  it("Comp attack = 0.092 × (80/0.092)^((raw−57)/226): 0.092 … 80 ms log", () => {
    expect(ssmcsAttackMs(SSMCS_ATTACK_RAW_MIN)).toBeCloseTo(0.092, 5); // raw 57
    expect(ssmcsAttackMs(SSMCS_ATTACK_RAW_MAX)).toBeCloseTo(80, 5); // raw 283
    expect(ssmcsAttackMs(170)).toBeCloseTo(2.713, 2); // geometric midpoint
  });

  it("Comp release = 9.3 × (999/9.3)^((raw−24)/276): 9.3 … 999 ms log", () => {
    expect(ssmcsReleaseMs(SSMCS_RELEASE_RAW_MIN)).toBeCloseTo(9.3, 5); // raw 24
    expect(ssmcsReleaseMs(SSMCS_RELEASE_RAW_MAX)).toBeCloseTo(999, 5); // raw 300
    expect(ssmcsReleaseMs(162)).toBeCloseTo(96.39, 1); // geometric midpoint
  });

  it("Comp ratio interpolates the calibrated anchor table, ∞ at the top", () => {
    // Anchors: raw 0=1.0, 30=2.5, 60=4.0, 75=6.0, 90=14.0, 105=38.0; top detent = ∞.
    expect(ssmcsRatio(0)).toBe(1);
    expect(ssmcsRatio(30)).toBe(2.5);
    expect(ssmcsRatio(60)).toBe(4);
    expect(ssmcsRatio(75)).toBe(6);
    expect(ssmcsRatio(90)).toBe(14);
    expect(ssmcsRatio(105)).toBe(38);
    expect(ssmcsRatio(45)).toBeCloseTo(3.25, 5); // between anchors 30 and 60
    expect(ssmcsRatio(SSMCS_RATIO_RAW_MAX)).toBe(Infinity); // raw 120 = ∞:1
    // Between the last real anchor (105) and the ∞ detent (120): held at 38.
    expect(ssmcsRatio(110)).toBe(38);
  });
});

describe("SSMCS Sweet Spot Data codec (preset index ↔ device 4-digit string)", () => {
  it("encodes a valid index to the zero-padded 4-digit string", () => {
    expect(sweetSpotDataToStr(1)).toBe("0001"); // 01 Basic (factory default)
    expect(sweetSpotDataToStr(34)).toBe("0034");
  });

  it("clamps an out-of-range index into [1, 34] rather than wrapping", () => {
    expect(sweetSpotDataToStr(0)).toBe("0001"); // below the first preset
    expect(sweetSpotDataToStr(SWEET_SPOT_DATA_MAX + 1)).toBe("0034"); // past the last
    expect(sweetSpotDataToStr(-5)).toBe("0001");
  });

  it("decodes the device string back to the index, falling back to 1 when blank", () => {
    expect(strToSweetSpotData("0001")).toBe(1);
    expect(strToSweetSpotData("0034")).toBe(34);
    expect(strToSweetSpotData("")).toBe(1); // device reported no value
    expect(strToSweetSpotData("garbage")).toBe(1); // unparseable
    expect(strToSweetSpotData("0035")).toBe(34); // over-range clamps down
  });

  it("round-trips every preset index through the string form", () => {
    for (let i = 1; i <= SWEET_SPOT_DATA_MAX; i++) {
      expect(strToSweetSpotData(sweetSpotDataToStr(i))).toBe(i);
    }
  });
});
