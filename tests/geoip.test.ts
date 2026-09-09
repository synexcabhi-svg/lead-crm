import { describe, it, expect } from "vitest";
import { parseGeoResponse, isPrivateOrLocal } from "@/lib/geoip";

describe("isPrivateOrLocal", () => {
  it("treats localhost / private ranges as non-lookup-able", () => {
    for (const ip of ["::1", "127.0.0.1", "localhost", "10.0.0.5", "192.168.1.20", "172.16.9.9", "unknown", ""]) {
      expect(isPrivateOrLocal(ip)).toBe(true);
    }
  });
  it("treats a public IP as lookup-able", () => {
    expect(isPrivateOrLocal("8.8.8.8")).toBe(false);
    expect(isPrivateOrLocal("49.36.12.34")).toBe(false);
  });
});

describe("parseGeoResponse (ipwho.is shape)", () => {
  it("maps city / region / country / postal", () => {
    expect(
      parseGeoResponse({
        success: true,
        city: "Bengaluru",
        region: "Karnataka",
        country: "India",
        postal: "560001",
      }),
    ).toEqual({ city: "Bengaluru", state: "Karnataka", country: "India", postalCode: "560001" });
  });
  it("also understands ipapi.co-style field names", () => {
    expect(parseGeoResponse({ city: "Pune", region_name: "Maharashtra", country_name: "India" })).toEqual({
      city: "Pune",
      state: "Maharashtra",
      country: "India",
      postalCode: null,
    });
  });
  it("returns null when the provider reports failure", () => {
    expect(parseGeoResponse({ success: false, message: "reserved range" })).toBeNull();
  });
  it("returns null when there is nothing usable", () => {
    expect(parseGeoResponse({})).toBeNull();
    expect(parseGeoResponse(null)).toBeNull();
    expect(parseGeoResponse("nope")).toBeNull();
  });
});
