# Font sources

The exact font files the Toybox design uses, downloaded on 2026-09-28. All are under the SIL Open Font License 1.1 (the matching `*-OFL.txt` sits next to each family). The app bundles these same files, and design screenshots load them too, so text renders the same in both.

## Files

| File | Family / PostScript name | Weight | Version | sha256 |
|---|---|---|---|---|
| `LilitaOne.ttf` | Lilita One / `LilitaOne` | 400 | 1.002 | `f5b641c45c69d772ee4eda687bc9fda411d5cad6b0b45371491da4580cbc8d59` |
| `Rubik-Regular.ttf` | Rubik / `Rubik-Regular` | 400 | 2.300 | `81518bc58b15cfa0cdf4bb149b63032121b691ecf298fc7da6fd2063fb80517e` |
| `Rubik-Medium.ttf` | Rubik (typographic family) / `Rubik-Medium` | 500 | 2.300 | `0a72404de99c51a873eeb4c1f6fb6188a29716911f44dada1b8fa56d79f0c0d2` |
| `Rubik-Bold.ttf` | Rubik / `Rubik-Bold` | 700 | 2.300 | `d8bd37af963dd47e984df6a38017dd82a5a7a8304414235681919c52b321e340` |
| `Vazirmatn-Regular.ttf` | Vazirmatn / `Vazirmatn-Regular` | 400 | 33.003 | `b69fd4c680b8f3f225feabcc655a2c585d97627b8f5f5c0f9985e894069f3a56` |
| `Vazirmatn-Bold.ttf` | Vazirmatn / `Vazirmatn-Bold` | 700 | 33.003 | `f635fdbea28f265de395ba83b4b1570dcf2f58d13c65469e61903b1c2d2ae723` |
| `LilitaOne-OFL.txt` | Licence for Lilita One | - | - | `255d5debbb80eb2ea762644311f266a279e8778f00156655a516e2b7781a63e1` |
| `Rubik-OFL.txt` | Licence for Rubik | - | - | `472cbe7c25441df63e9c7864b43eb3c0f4b3df950c66a76224e6cfe1eae843fb` |
| `Vazirmatn-OFL.txt` | Licence for Vazirmatn | - | - | `17e355067c8284f47743a1ee3b1ef7ff684ff0601eda357f9353b10b3016ab31` |

Each file name equals its PostScript name, so `fontFamily: 'Rubik-Bold'` works the same on iOS and in the design HTML.

## Where each file came from

| File | Source URL |
|---|---|
| `LilitaOne.ttf` | https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl/lilitaone/LilitaOne-Regular.ttf (saved as `LilitaOne.ttf`) |
| `LilitaOne-OFL.txt` | https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl/lilitaone/OFL.txt |
| `Rubik-Regular.ttf` | https://raw.githubusercontent.com/googlefonts/rubik/9167c98fa8699d75ee51769eba20d81beb16bcb5/fonts/ttf/Rubik-Regular.ttf |
| `Rubik-Medium.ttf` | https://raw.githubusercontent.com/googlefonts/rubik/9167c98fa8699d75ee51769eba20d81beb16bcb5/fonts/ttf/Rubik-Medium.ttf |
| `Rubik-Bold.ttf` | https://raw.githubusercontent.com/googlefonts/rubik/9167c98fa8699d75ee51769eba20d81beb16bcb5/fonts/ttf/Rubik-Bold.ttf |
| `Rubik-OFL.txt` | https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl/rubik/OFL.txt (byte-identical to the upstream repo's OFL.txt at the commit above) |
| `Vazirmatn-Regular.ttf` | `fonts/ttf/Vazirmatn-Regular.ttf` inside https://github.com/rastikerdar/vazirmatn/releases/download/v33.003/vazirmatn-v33.003.zip |
| `Vazirmatn-Bold.ttf` | `fonts/ttf/Vazirmatn-Bold.ttf` inside the same zip |
| `Vazirmatn-OFL.txt` | `OFL.txt` inside the same zip (identical to https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/OFL.txt) |

The v33.003 release zip has sha256 `0a9afd41967e6f57096a56a181a23f81a2b999b62f1f2a4e4b26736580854fdb` (13,047,191 bytes; tag commit `f68f7bc5dd1d046bd6a5a2bda355bd6d430e807a`).

## Why Rubik comes from the upstream repo

The google/fonts repo ships Rubik only as a variable font:

- `ofl/rubik/Rubik[wght].ttf`, weight axis 300 to 900, version 2.300, sha256 `1b3a7437ba2af80e465e773ed60c5036d1ba6ace492d89046dbcf18fb31e4e88`, from https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl/rubik/Rubik%5Bwght%5D.ttf. Its default instance is named "Rubik Light".

React Native on iOS does not select weights from a variable font reliably, so the app needs static files. The google/fonts METADATA for Rubik names its upstream as the googlefonts/rubik repo at commit `9167c98fa8699d75ee51769eba20d81beb16bcb5`. That repo's `fonts/ttf/` folder holds the static instances built from the same sources (version 2.300, the same as the variable font), and those are the files here. The variable font is documented above but not shipped.

## Checking the files

Run `shasum -a 256 *.ttf *.txt` in this folder and compare with the table. To refresh a font, download it from its URL, check the new hash, and update this file.
