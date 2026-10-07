function freeze(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") freeze(child);
  }
  return Object.freeze(value);
}

function scene(slug, title, description, slots) {
  return { slug, title, description, slots, requiresSourceVideo: true, website: `https://aivideoswap.com/template/${slug}` };
}

export const SCENES = freeze({
  "hotel-lobby": scene("hotel-lobby", "Hotel Lobby", "Two performers against an orange background under a hanging microphone.", [
    { role: "left-performer", label: "Left performer", framing: "portrait" },
    { role: "right-performer", label: "Right performer", framing: "portrait" },
  ]),
  "hit-the-road-dude": scene("hit-the-road-dude", "Hit the Road Dude", "Replace the driver in the prepared private-property driving scene; retain the vehicle.", [
    { role: "driver", label: "Driver", framing: "portrait" },
  ]),
  "gang-gang-dance": scene("gang-gang-dance", "Gang Gang Dance", "Replace the lead dancer in a prepared blue-lit stage scene.", [
    { role: "lead-dancer", label: "Lead dancer", framing: "portrait" },
  ]),
  "sega-dance-walk": scene("sega-dance-walk", "Sega Dance Walk", "Place one person into the prepared corridor walking-dance scene.", [
    { role: "walker", label: "Walking dancer", framing: "portrait" },
  ]),
  "training-season-train-challenge": scene("training-season-train-challenge", "Training Season Train Challenge", "Prepare one full-body reference for a phone-on-train-style platform scene; no complete chase is promised.", [
    { role: "person", label: "Platform performer", framing: "full-body" },
  ]),
});

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const VIDEO_EXTENSIONS = ["mp4", "webm"];
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function mediaReference(source, extensions) {
  if (typeof source !== "string" || !source || /[\s\u0000-\u001f\u007f]/u.test(source)) return null;
  let pathname;
  let normalized;
  if (/^https:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash) return null;
      pathname = decodeURIComponent(url.pathname);
      if (/[\u0000-\u001f\u007f]/u.test(pathname)) return null;
      normalized = url.href;
    } catch { return null; }
  } else {
    if (/^[a-z][a-z\d+.-]*:/i.test(source) || /^[\/\\]/u.test(source) || /[?#:]/u.test(source)) return null;
    try { pathname = decodeURIComponent(source).replaceAll("\\", "/"); }
    catch { return null; }
    if (/^[\/]/u.test(pathname) || /[\u0000-\u001f\u007f?#:]/u.test(pathname)) return null;
    const segments = pathname.split("/");
    if (segments.includes("..") || segments.some((part) => part === "")) return null;
    normalized = segments.filter((part) => part !== ".").join("/");
  }
  const extension = pathname.split(".").at(-1).toLowerCase();
  if (!extensions.includes(extension)) return null;
  return { source: normalized, kind: /^https:\/\//i.test(source) ? "https-url" : "relative-path" };
}

export class ValidationError extends Error {
  constructor(errors) {
    super("The configuration did not pass offline validation.");
    this.name = "ValidationError";
    this.code = "INVALID_CONFIGURATION";
    this.errors = errors;
  }
}

export function validate(config) {
  const errors = [];
  const add = (field, code, message) => errors.push({ field, code, message });
  const object = (value, field, allowed, required = allowed) => {
    if (!isObject(value)) { add(field, "invalid_object", "Expected an object."); return false; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) add(field ? `${field}.${key}` : key, "unknown_field", "Unknown fields are not accepted.");
    for (const key of required) if (!Object.hasOwn(value, key)) add(field ? `${field}.${key}` : key, "required", "This field is required.");
    return true;
  };
  if (!object(config, "", ["scene", "references", "sourceVideo", "parameters", "capabilities"])) return { ok: false, errors };
  const definition = typeof config.scene === "string" && Object.hasOwn(SCENES, config.scene) ? SCENES[config.scene] : null;
  if (!definition) add("scene", "unknown_scene", "Choose one of the exported SCENES.");
  if (!mediaReference(config.sourceVideo, VIDEO_EXTENSIONS)) add("sourceVideo", "invalid_source", "Use an HTTPS MP4/WebM URL or a relative MP4/WebM path without traversal.");

  if (!Array.isArray(config.references)) add("references", "invalid_array", "Expected an array of photo references.");
  else {
    if (definition && config.references.length !== definition.slots.length) add("references", "reference_count", `This scene requires exactly ${definition.slots.length} photo references.`);
    const roles = new Set();
    const sources = new Set();
    config.references.forEach((reference, index) => {
      const field = `references[${index}]`;
      if (!object(reference, field, ["role", "source", "framing"])) return;
      const slot = definition?.slots.find((item) => item.role === reference.role);
      if (!slot) add(`${field}.role`, "unknown_role", "The role must match an explicit slot in this scene.");
      if (roles.has(reference.role)) add(`${field}.role`, "duplicate_role", "Each scene role must appear exactly once.");
      roles.add(reference.role);
      const source = mediaReference(reference.source, IMAGE_EXTENSIONS);
      if (!source) add(`${field}.source`, "invalid_source", "Use an HTTPS JPEG/PNG/WebP URL or a relative image path without traversal.");
      else {
        if (sources.has(source.source)) add(`${field}.source`, "duplicate_reference", "Use a distinct photo reference for each role.");
        sources.add(source.source);
      }
      if (!slot || reference.framing !== slot.framing) add(`${field}.framing`, "framing_mismatch", `Declare the framing required by the scene${slot ? `: ${slot.framing}` : ""}. This does not verify the photo's contents.`);
    });
    if (definition) for (const slot of definition.slots) if (!roles.has(slot.role)) add("references", "missing_role", `A reference for ${slot.role} is required.`);
  }

  const hasParameters = object(config.parameters, "parameters", ["durationSeconds", "resolution", "aspectRatio"]);
  const hasCapabilities = object(config.capabilities, "capabilities", ["minDurationSeconds", "maxDurationSeconds", "resolutions", "aspectRatios"]);
  if (hasCapabilities) {
    const capability = config.capabilities;
    for (const key of ["minDurationSeconds", "maxDurationSeconds"]) {
      if (!Number.isSafeInteger(capability[key]) || capability[key] <= 0) add(`capabilities.${key}`, "invalid_range", "Declare a positive integer number of seconds.");
    }
    if (capability.minDurationSeconds > capability.maxDurationSeconds) add("capabilities", "invalid_range", "Minimum duration cannot exceed maximum duration.");
    for (const [key, pattern] of [["resolutions", /^[1-9]\d*p$/u], ["aspectRatios", /^[1-9]\d*:[1-9]\d*$/u]]) {
      const choices = capability[key];
      if (!Array.isArray(choices) || !choices.length || Array.from(choices).some((value) => typeof value !== "string" || value.trim() !== value || !pattern.test(value)) || new Set(choices).size !== choices.length) add(`capabilities.${key}`, "invalid_choices", "Declare a non-empty list of unique valid choices.");
    }
  }
  if (hasParameters) {
    const parameters = config.parameters;
    if (!Number.isSafeInteger(parameters.durationSeconds) || parameters.durationSeconds <= 0) add("parameters.durationSeconds", "invalid_duration", "Duration must be a positive integer number of seconds.");
    else if (hasCapabilities && (parameters.durationSeconds < config.capabilities.minDurationSeconds || parameters.durationSeconds > config.capabilities.maxDurationSeconds)) add("parameters.durationSeconds", "unsupported_duration", "Duration falls outside the caller-declared capabilities.");
    for (const [key, choices] of [["resolution", "resolutions"], ["aspectRatio", "aspectRatios"]]) {
      if (typeof parameters[key] !== "string" || !parameters[key]) add(`parameters.${key}`, "invalid_parameter", "Choose an explicit output parameter.");
      else if (hasCapabilities && Array.isArray(config.capabilities[choices]) && !config.capabilities[choices].includes(parameters[key])) add(`parameters.${key}`, "unsupported_parameter", "This choice is outside the caller-declared capabilities.");
    }
  }
  return { ok: errors.length === 0, errors };
}

export function prepare(config) {
  const result = validate(config);
  if (!result.ok) throw new ValidationError(result.errors);
  const definition = SCENES[config.scene];
  return {
    format: "video-template-kit/request-v1",
    offline: true,
    provider: null,
    scene: definition.slug,
    sourceVideo: mediaReference(config.sourceVideo, VIDEO_EXTENSIONS),
    references: definition.slots.map((slot) => {
      const reference = config.references.find((item) => item.role === slot.role);
      return { role: slot.role, framing: reference.framing, ...mediaReference(reference.source, IMAGE_EXTENSIONS) };
    }),
    parameters: { ...config.parameters },
    capabilities: { ...config.capabilities, resolutions: [...config.capabilities.resolutions], aspectRatios: [...config.capabilities.aspectRatios] },
    checks: { referenceSyntax: true, roleMapping: true, callerDeclaredCapabilities: true, fileExistence: false, mediaContents: false, identityRecognition: false, providerCompatibility: false, rendered: false },
  };
}
