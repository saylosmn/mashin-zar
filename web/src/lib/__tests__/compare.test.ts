import { describe, expect, it } from "vitest";
import { COMPARE_MAX, bestIndexes, compareHref, parseIds, toggleId } from "../compare";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";

describe("parseIds", () => {
  it("буруу, давхардсан утгыг хаяж, дарааллыг хадгална", () => {
    expect(parseIds(`${B},x,${A},${B}`)).toEqual([B, A]);
  });
  it("том үсгийг жижиг болгоно", () => expect(parseIds(A.toUpperCase())).toEqual([A]));
  it(`хамгийн ихдээ ${COMPARE_MAX}`, () => expect(parseIds([A, B, C, D])).toEqual([A, B, C]));
  it("хоосон", () => {
    expect(parseIds(undefined)).toEqual([]);
    expect(parseIds("")).toEqual([]);
    expect(parseIds("'; drop table ads;--")).toEqual([]);
  });
});

describe("toggleId", () => {
  it("нэмэх, хасах", () => {
    expect(toggleId([A], B)).toEqual([A, B]);
    expect(toggleId([A, B], A)).toEqual([B]);
  });
  it("дүүрсэн үед хамгийн хуучныг гаргана", () => expect(toggleId([A, B, C], D)).toEqual([B, C, D]));
  it("том үсэгтэй id-г ч таньна", () => expect(toggleId([A], A.toUpperCase())).toEqual([]));
});

describe("bestIndexes", () => {
  it("хамгийн бага үнэ", () => expect(bestIndexes([30, 20, 25], "min")).toEqual([1]));
  it("хамгийн шинэ он, тэнцүү бол хоёулаа", () => expect(bestIndexes([2018, 2020, 2020], "max")).toEqual([1, 2]));
  it("бүгд тэнцүү эсвэл нэг л утга бол тодруулахгүй", () => {
    expect(bestIndexes([5, 5], "max")).toEqual([]);
    expect(bestIndexes([null, 2019, undefined], "max")).toEqual([]);
  });
  it("null-ийг алгасна", () => expect(bestIndexes([null, 2015, 2019], "max")).toEqual([2]));
});

it("compareHref", () => {
  expect(compareHref([])).toBe("/compare");
  expect(compareHref([A, B])).toBe(`/compare?ids=${A},${B}`);
});
