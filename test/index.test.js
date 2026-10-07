import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { prepare, SCENES, validate, ValidationError } from "../src/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const one = JSON.parse(await readFile(new URL("../examples/one-person.json", import.meta.url), "utf8"));
const two = JSON.parse(await readFile(new URL("../examples/two-person.json", import.meta.url), "utf8"));
const copy = (value) => structuredClone(value);
const has = (config, code) => validate(config).errors.some((error) => error.code === code);
const cli = (...args) => spawnSync(process.execPath, [path.join(root, "bin/video-template-kit.js"), ...args], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH } });

test("both documented examples run without media files or a provider", () => {
  for (const input of [one, two]) {
    assert.deepEqual(validate(input), { ok: true, errors: [] });
    const result = prepare(input);
    assert.equal(result.offline, true);
    assert.equal(result.provider, null);
    assert.equal(result.references.length, SCENES[input.scene].slots.length);
    for (const field of ["fileExistence", "mediaContents", "identityRecognition", "providerCompatibility", "rendered"]) assert.equal(result.checks[field], false);
  }
});

test("all five scene definitions prepare their declared roles", () => {
  assert.equal(Object.keys(SCENES).length, 5);
  for (const definition of Object.values(SCENES)) {
    const input = copy(one);
    input.scene = definition.slug;
    input.references = definition.slots.map((slot, index) => ({ role: slot.role, source: `inputs/person-${index}.jpg`, framing: slot.framing }));
    assert.deepEqual(prepare(input).references.map((item) => item.role), definition.slots.map((slot) => slot.role));
  }
});

test("reordering the array never swaps the left and right identities", () => {
  const input = copy(two);
  input.references.reverse();
  const result = prepare(input);
  assert.deepEqual(result.references.map(({ role, source }) => ({ role, source })), [
    { role: "left-performer", source: "inputs/alice.jpg" },
    { role: "right-performer", source: "inputs/bob.png" },
  ]);
});

test("explicitly changing role labels intentionally changes the mapping", () => {
  const input = copy(two);
  [input.references[0].role, input.references[1].role] = [input.references[1].role, input.references[0].role];
  const result = prepare(input);
  assert.equal(result.references[0].role, "left-performer");
  assert.equal(result.references[0].source, "inputs/bob.png");
  assert.equal(result.references[1].source, "inputs/alice.jpg");
});

test("wrong reference count, duplicate roles and missing roles fail", () => {
  const missing = copy(two);
  missing.references.pop();
  assert.ok(has(missing, "reference_count"));
  assert.ok(has(missing, "missing_role"));
  const extra = copy(one);
  extra.references.push({ role: "other", source: "inputs/other.jpg", framing: "portrait" });
  assert.ok(has(extra, "reference_count"));
  assert.ok(has(extra, "unknown_role"));
  const duplicate = copy(two);
  duplicate.references[1].role = duplicate.references[0].role;
  assert.ok(has(duplicate, "duplicate_role"));
  assert.ok(has(duplicate, "missing_role"));
});

test("duplicate photo references fail after local-path or HTTPS normalization", () => {
  for (const sources of [["./inputs/person.jpg", "inputs/person.jpg"], ["https://example.test/person.jpg", "https://EXAMPLE.test:443/person.jpg"]]) {
    const input = copy(two);
    input.references.forEach((reference, index) => { reference.source = sources[index]; });
    assert.ok(has(input, "duplicate_reference"));
  }
});

test("unknown properties cannot silently change the request contract", () => {
  for (const alter of [
    (input) => { input.apiKey = "unused"; },
    (input) => { input.references[0].identity = "unverified"; },
    (input) => { input.parameters.duration = 10; },
    (input) => { input.capabilities.model = "unknown"; },
  ]) {
    const input = copy(one);
    alter(input);
    assert.ok(has(input, "unknown_field"));
  }
});

test("every missing request field or output parameter is rejected", () => {
  for (const field of Object.keys(one)) {
    const input = copy(one);
    delete input[field];
    assert.ok(has(input, "required"), field);
  }
  for (const field of Object.keys(one.parameters)) {
    const input = copy(one);
    delete input.parameters[field];
    assert.ok(has(input, "required"), field);
  }
  for (const field of Object.keys(one.capabilities)) {
    const input = copy(one);
    delete input.capabilities[field];
    assert.ok(has(input, "required"), field);
  }
});

test("duration uses caller-declared capabilities, including exact endpoints", () => {
  for (const seconds of [4, 12]) {
    const input = copy(one);
    input.parameters.durationSeconds = seconds;
    assert.equal(validate(input).ok, true);
  }
  for (const seconds of [3, 13]) {
    const input = copy(one);
    input.parameters.durationSeconds = seconds;
    assert.ok(has(input, "unsupported_duration"));
  }
  const extended = copy(one);
  extended.capabilities.maxDurationSeconds = 60;
  extended.parameters.durationSeconds = 37;
  assert.equal(validate(extended).ok, true, "The kit must not invent a hosted-service maximum.");
});

test("invalid and coercible duration values fail instead of being guessed", () => {
  for (const durationSeconds of ["8", 0, -1, 7.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null]) {
    const input = copy(one);
    input.parameters.durationSeconds = durationSeconds;
    assert.ok(has(input, "invalid_duration"));
  }
});

test("capability declarations must be well-formed and unambiguous", () => {
  for (const alter of [
    (input) => { input.capabilities.minDurationSeconds = 20; },
    (input) => { input.capabilities.maxDurationSeconds = 0; },
    (input) => { input.capabilities.maxDurationSeconds = "12"; },
    (input) => { input.capabilities.resolutions = []; },
    (input) => { input.capabilities.resolutions = ["720p", "720p"]; },
    (input) => { input.capabilities.resolutions = ["720"]; },
    (input) => { input.capabilities.aspectRatios = ["0:16"]; },
    (input) => { input.capabilities.aspectRatios = "9:16"; },
  ]) {
    const input = copy(one);
    alter(input);
    assert.equal(validate(input).ok, false);
  }
});

test("unsupported resolution and aspect ratio fail the declared capability", () => {
  for (const [field, value] of [["resolution", "1080p"], ["aspectRatio", "1:1"]]) {
    const input = copy(one);
    input.parameters[field] = value;
    assert.ok(has(input, "unsupported_parameter"));
  }
});

test("sparse capability arrays and whitespace choices cannot bypass validation", () => {
  for (const field of ["resolutions", "aspectRatios"]) {
    const sparse = copy(one);
    sparse.capabilities[field].length += 1;
    assert.ok(has(sparse, "invalid_choices"));
    assert.throws(() => prepare(sparse), ValidationError);
    const whitespace = copy(one);
    whitespace.capabilities[field][0] += "\n";
    assert.ok(has(whitespace, "invalid_choices"));
  }
});

test("full-body framing is a declaration, not facial or pose recognition", () => {
  const input = copy(one);
  input.scene = "training-season-train-challenge";
  input.references[0].role = "person";
  assert.ok(has(input, "framing_mismatch"));
  input.references[0].framing = "full-body";
  assert.equal(validate(input).ok, true);
  assert.equal(prepare(input).checks.identityRecognition, false);
});

test("unsafe or unsuitable photo references are rejected without access", () => {
  for (const source of [
    "http://example.test/photo.jpg", "https://user:secret@example.test/photo.jpg", "https://example.test/photo.jpg#fragment",
    "data:image/jpeg;base64,ZmFrZQ==", "file:///tmp/photo.jpg", "javascript:photo.jpg", "https:example.test/photo.jpg",
    "/tmp/photo.jpg", "C:\\photos\\photo.jpg", "../photo.jpg", "inputs/../photo.jpg", "inputs/%2e%2e/photo.jpg", "https://example.test/%00photo.jpg",
    "inputs/%2fprivate.jpg", "inputs/%00photo.jpg", "inputs/photo.txt", " inputs/photo.jpg", "inputs//photo.jpg", "inputs/photo.jpg?key=secret",
  ]) {
    const input = copy(one);
    input.references[0].source = source;
    assert.ok(has(input, "invalid_source"), source);
  }
});

test("video source must use a valid MP4 or WebM reference", () => {
  for (const sourceVideo of [undefined, "inputs/scene.jpg", "../scene.mp4", "https://example.test/scene.mp4#fragment"]) {
    const input = copy(one);
    input.sourceVideo = sourceVideo;
    assert.ok(has(input, "invalid_source"));
  }
  const input = copy(one);
  input.sourceVideo = "https://example.test/scene.webm";
  input.references[0].source = "https://example.test/photo.JPEG";
  assert.equal(validate(input).ok, true);
});

test("malformed containers and inherited scene names fail cleanly", () => {
  for (const input of [null, [], "config", 42, { ...copy(one), scene: "toString" }, { ...copy(one), references: [null] }, { ...copy(one), parameters: null }, { ...copy(one), capabilities: [] }]) {
    assert.equal(validate(input).ok, false);
  }
});

test("prepare throws structured errors and never mutates caller input", () => {
  const snapshot = JSON.stringify(two);
  const prepared = prepare(two);
  prepared.parameters.durationSeconds = 99;
  prepared.capabilities.resolutions.push("1080p");
  assert.equal(JSON.stringify(two), snapshot);
  assert.throws(() => prepare({ ...copy(one), scene: "missing" }), (error) => error instanceof ValidationError && error.code === "INVALID_CONFIGURATION" && Array.isArray(error.errors));
  assert.equal(Object.isFrozen(SCENES["hotel-lobby"].slots[0]), true);
});

test("library preparation makes no network requests", () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Network access is forbidden."); };
  try {
    const input = copy(one);
    input.references[0].source = "https://example.test/photo.jpg";
    input.sourceVideo = "https://example.test/scene.mp4";
    assert.equal(prepare(input).offline, true);
  } finally { globalThis.fetch = original; }
});

test("CLI examples, help and usage return the documented exit codes", () => {
  assert.equal(cli("--help").status, 0);
  assert.equal(cli("validate", "examples/one-person.json").status, 0);
  const prepared = cli("prepare", "examples/two-person.json");
  assert.equal(prepared.status, 0);
  assert.equal(JSON.parse(prepared.stdout).references[0].role, "left-performer");
  assert.equal(cli("render", "examples/one-person.json").status, 2);
  assert.equal(cli("validate").status, 2);
  assert.equal(cli("validate", "examples/one-person.json", "--provider").status, 2);
});

test("CLI reports validation/read errors without echoing input contents", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "video-template-kit-test-"));
  try {
    const invalidPath = path.join(temporary, "invalid.json");
    await writeFile(invalidPath, JSON.stringify({ ...copy(one), apiKey: "sensitive-fixture-value" }));
    const invalid = cli("validate", invalidPath);
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, "");
    assert.equal(invalid.stderr.includes("sensitive-fixture-value"), false);
    const malformedPath = path.join(temporary, "malformed.json");
    await writeFile(malformedPath, "{not JSON sensitive-fixture-value");
    const malformed = cli("prepare", malformedPath);
    assert.equal(malformed.status, 2);
    assert.equal(malformed.stderr.includes("sensitive-fixture-value"), false);
    assert.equal(cli("prepare", path.join(temporary, "missing.json")).status, 2);
    const oversizedPath = path.join(temporary, "oversized.json");
    await writeFile(oversizedPath, " ".repeat(1024 * 1024 + 1));
    assert.equal(cli("validate", oversizedPath).status, 2);
    assert.equal(cli("validate", temporary).status, 2);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
