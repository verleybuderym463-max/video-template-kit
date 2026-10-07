# Video Template Kit by AI Video Swap

Prepare one-person and two-person video-template inputs with explicit photo slots, role mapping, and offline request validation.

Zero dependencies. JavaScript ES modules. Node.js 20 or newer. MIT licensed.

[Try the offline browser demo](https://verleybuderym463-max.github.io/video-template-kit/demo/) | [Browse the hosted video templates](https://aivideoswap.com/templates?utm_source=github&utm_medium=referral&utm_campaign=video-template-kit&utm_content=readme) | [Two-person role mapping](docs/two-person-role-mapping.md)

## What works

- Validate declared photo count, portrait/full-body framing, and required roles.
- Keep left and right performers explicit, even when the input array is reordered.
- Check media-reference syntax and parameters against capabilities supplied by your integration.
- Produce a provider-neutral request manifest for your own adapter.
- Try the same validation locally in a browser, without uploading photos.

Validation checks metadata, not image content. It does not recognize faces, assess photo quality, check file existence, download media, call a model, or render a video. Capability values in the examples are illustrative; they are not production service limits.

## Run the examples

```sh
git clone https://github.com/verleybuderym463-max/video-template-kit.git
cd video-template-kit
npm test
node bin/video-template-kit.js validate examples/two-person.json
node bin/video-template-kit.js prepare examples/two-person.json
npm run demo
```

Open the local URL printed by the demo server. No account, API key, package installation, or paid generation is needed for these examples. The example media paths are placeholders, not bundled photos or videos. CLI validation failures return a nonzero exit code.

This repository is not published on npm. Use the checked-out source or install from a local checkout.

## Use the library

```js
import { SCENES, validate, prepare } from './src/index.js';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile('examples/two-person.json', 'utf8'));
const result = validate(config);

if (!result.ok) {
  console.error(result.errors);
} else {
  const request = prepare(config);
  console.log(request);
}

console.log(SCENES['hotel-lobby'].slots);
```

`prepare` validates first and rejects invalid configuration. Passing validation means that the declared input contract is consistent; it does not mean a provider has accepted a request or generated a video.

## Five scene guides

These guides distinguish the actual scene, input roles, and hosted production path. The kit provides input preparation; the website provides a separate hosted generation service.

| Scene | Hosted photo input | Scene guide | Make it on the website |
| --- | --- | --- | --- |
| Hotel Lobby | Two portraits, one per performer | [Orange-background microphone performance](docs/scenes/hotel-lobby.md) | [Hotel Lobby template](https://aivideoswap.com/template/hotel-lobby?utm_source=github&utm_medium=referral&utm_campaign=video-template-kit&utm_content=readme-hotel) |
| Hit the Road Dude | One portrait for the driver | [Private-property driver meme](docs/scenes/hit-the-road-dude.md) | [Hit the Road Dude template](https://aivideoswap.com/template/hit-the-road-dude?utm_source=github&utm_medium=referral&utm_campaign=video-template-kit&utm_content=readme-hit-road) |
| Gang Gang Dance | One portrait for the lead dancer | [Blue-lit stage dance](docs/scenes/gang-gang-dance.md) | [Gang Gang Dance template](https://aivideoswap.com/template/gang-gang-dance?utm_source=github&utm_medium=referral&utm_campaign=video-template-kit&utm_content=readme-gang) |
| Sega Dance Walk | One portrait for the walker | [Corridor walking dance](docs/scenes/sega-dance-walk.md) | [Sega Dance Walk template](https://aivideoswap.com/template/sega-dance-walk?utm_source=github&utm_medium=referral&utm_campaign=video-template-kit&utm_content=readme-sega) |
| Training Season Train Challenge | One full-body photo | [Train-platform phone scene](docs/scenes/training-season-train-challenge.md) | [Training Season template](https://aivideoswap.com/template/training-season-train-challenge?utm_source=github&utm_medium=referral&utm_campaign=video-template-kit&utm_content=readme-training) |

For Hotel Lobby, left/right refers to the intended output frame, not the order of file selection. In the library, each photo carries an explicit `role`.

## Source video and rendering

Your integration supplies a licensed source video to the kit and converts the prepared manifest into the schema required by your chosen provider. This repository contains no provider credentials, proprietary template source videos, model weights, or rendering executor.

On the hosted AI Video Swap template pages, the selected template supplies the target scene. Customers follow that page's current input and pricing requirements; they do not have to supply the kit's example reference-video path. Hosted generation may incur charges. The open-source license does not grant free cloud inference or rights to third-party music, likenesses, or footage.

## Privacy and scope

The CLI does not send network requests. The demo reads chosen photos locally for previews and uses metadata for validation. Following a website link opens that site; it does not automatically transfer your chosen photos or request manifest.

Do not commit API keys, real customer photos, payment data, signed media URLs, or production environment files. The MIT license covers this repository's original code and documentation. External websites and linked media have their own terms and rights.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Useful contributions include input-contract tests, accessible demo improvements, and accurate scene explanations. Provider integrations should include explicit capability declarations and tests without paid network calls.

## Version

Initial release: `0.1.0`. See [CHANGELOG.md](CHANGELOG.md) for scope and limitations.
