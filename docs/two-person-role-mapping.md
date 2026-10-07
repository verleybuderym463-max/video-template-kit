# Map two portrait photos to left and right performers

A two-person video request should preserve each person's role explicitly. Array order and file-picker order are fragile ways to express who appears on the left or right of the output frame.

In Video Template Kit, the Hotel Lobby scene has two slots: `left-performer` and `right-performer`. Each reference declares its role and framing:

```json
[
  { "role": "right-performer", "source": "./references/person-b.jpg", "framing": "portrait" },
  { "role": "left-performer", "source": "./references/person-a.jpg", "framing": "portrait" }
]
```

The input array above intentionally lists the right performer first. Preparation normalizes it to the scene's slot order while retaining the role on each reference. A downstream provider adapter must map those roles to the provider's documented slots; do not discard them and guess from array positions.

## Reproduce locally

```sh
node bin/video-template-kit.js validate examples/two-person.json
node bin/video-template-kit.js prepare examples/two-person.json
npm test
```

Use the browser demo to select local photos, inspect each role, and prepare the same metadata contract. Swapping the chosen photos is an explicit action. It does not change the meanings of the left/right slots.

## Check failures before calling a provider

- A missing performer must fail, rather than silently duplicating one portrait.
- Two references assigned to the same role must fail.
- The same source reference reused for both performers must fail.
- Unknown roles, undeclared parameter capabilities, or invalid media references must fail.
- Reordering valid references must retain the same role assignment.

This validator checks declared metadata only. It does not identify people in an image, verify the visible face, assess ownership, confirm file existence, or guarantee that a video model will preserve identity. Real provider execution needs its own contract tests and result review.

## Hosted scene

[Hotel Lobby on AI Video Swap](https://aivideoswap.com/template/hotel-lobby?utm_source=github&utm_medium=referral&utm_campaign=video-template-kit&utm_content=role-mapping-guide) is a two-person performance against an orange background beneath a hanging microphone. The hosted template supplies the scene; users provide the portraits.

When using the open-source kit in your own integration, you supply a licensed reference video and declared provider capabilities. Neither the example paths nor the kit contain the hosted template's private source footage.

See the [Hotel Lobby scene guide](scenes/hotel-lobby.md) and [two-person configuration](../examples/two-person.json).
