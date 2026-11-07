# Corpus sources

Product CSVs linted by `node scripts/run-corpus.mjs`. Date fetched: 2026-10-27.

Shopify's sample files are the product CSV templates published for download from the help center. A direct download from help.shopify.com returned HTTP 403 on the fetch date, so the bytes are the Internet Archive capture of that same URL. The capture URL is the URL in the table.

The other committed files come from public Git repositories whose licence is MIT. The URL is pinned to the commit that was fetched. The MIT licence text and each repository's copyright line are in [NOTICE.md](NOTICE.md).

## Committed

| File | URL | Licence | Date fetched | sha256 |
| --- | --- | --- | --- | --- |
| `files/help-product-template-20210819.csv` | https://web.archive.org/web/20210819235842id_/https://help.shopify.com/csv/product_template.csv | Shopify help-center sample, published for download (capture 2021-08-19) | 2026-10-27 | `5998e4e05283b47f572a05ef972907092a3c5b4d16b74a5c360de1a823146047` |
| `files/help-product-template-20220126.csv` | https://web.archive.org/web/20220126144708id_/https://help.shopify.com/csv/product_template.csv | Shopify help-center sample, published for download (capture 2022-01-26) | 2026-10-27 | `2f25079678ad1e87c832d9d532c3919036bda9eb9fc9f0387e5cfbaf9434ffec` |
| `files/help-product-template-20230601.csv` | https://web.archive.org/web/20230601182015id_/https://help.shopify.com/csv/product_template.csv | Shopify help-center sample, published for download (capture 2023-06-01) | 2026-10-27 | `5d265bbd3b040a4909e3518935ff2d604d937907c81d4f2bb3b318a99552cc89` |
| `files/help-product-template-20260216.csv` | https://web.archive.org/web/20260216174155id_/https://help.shopify.com/cdn/shopifycloud/help-center/csv/product_template.csv | Shopify help-center sample, published for download (capture 2026-02-16) | 2026-10-27 | `0f148a7ec9a1c1fc383d29511382c268feaff4fc7b9030b7ab841b58d016863b` |
| `files/help-product-template-csv-20260201.csv` | https://web.archive.org/web/20260201142409id_/https://help.shopify.com/cdn/shopifycloud/help-center/csv/product_template_csv.csv | Shopify help-center sample, published for download (capture 2026-02-01) | 2026-10-27 | `e1b136207b2dc8e8764203c1ddfa25536726a432e005862f0b310b1f06c925d2` |
| `files/shopify-transporter-products.csv` | https://github.com/Shopify/shopify_transporter/blob/c405f3d76c661b65eb6b5a0f836ac37740101dff/spec/files/transporter_csv_templates/products.csv | MIT | 2026-10-27 | `00443bc6e87ee605ba15fdf3adc976663e670de6aa3bbbadd023444e3a93eafb` |
| `files/shopify-b2b-products-import.csv` | https://github.com/Shopify/dotdev-workshop-b2b/blob/33ac695c5036edc62127d1510d53ef2a4a15cbb6/workshop-assets/products/products-import.csv | MIT | 2026-10-27 | `f902a3fa91df2d5d814a34892d2a4c50e53844a55bae74401b588445e6d42e8e` |
| `files/aamirtechs-products.csv` | https://github.com/aamirtechs/shopify-catalog-audit/blob/ea7b93d3a3af5f8b8c331a9b6737b2e93f993ea7/examples/products.csv | MIT | 2026-10-27 | `4900cf27a7bee73f6303c69febe6b1fb4f39a4def5abb6fcc37c244596491d38` |
| `files/apollos-products-cleaned.csv` | https://github.com/apolloscorner2017-ctrl/shopify-csv-doctor/blob/0fb12b0d226646b253caed160ebfd37dfa8bf2ed/sample/products_cleaned.csv | MIT | 2026-10-27 | `b1150cec05ea151bfa696ff6fa7c01b2175a0fc054ca9729e11c254cd41ef3d0` |
| `files/apollos-products-messy.csv` | https://github.com/apolloscorner2017-ctrl/shopify-csv-doctor/blob/0fb12b0d226646b253caed160ebfd37dfa8bf2ed/sample/products_messy.csv | MIT | 2026-10-27 | `5ed87217db8553598cd6199f4a025ff355e7a3ce44d164355c1b3bdd9661571a` |
| `files/astrodevit-sample-products.csv` | https://github.com/astrodevit-creator/shopify-ai-agent/blob/8d7a26699e17a3af66a7bf8ee4906ab5d9c61cd1/sample_products.csv | MIT | 2026-10-27 | `2a3765a12af409c4d06c67bc48ce74d8704d282ff76ac05f902d544ef9fa6003` |
| `files/carbondigital-product-template.csv` | https://github.com/carbondigitalus/typeorm-db-template-shopify-csv/blob/2aac952600410f4d8f1e00a8e480c44dbef5130a/src/data/shopify_product_template.csv | MIT | 2026-10-27 | `59b51b5d1455c637bc3019cac03f49cb269cae454fb544d9c64b6c60d1f9bb54` |
| `files/dehio-product-template.csv` | https://github.com/d-e-h-i-o/shopify_csv/blob/0c49666bca38802a756502f72f835abb63115025/shopify_csv/tests/fixtures/product_template.csv | MIT | 2026-10-27 | `b82e97c847d129a86fbd792901ab702fecadfee0bd98c1121bbcfa495796b085` |
| `files/desiria-products-before.csv` | https://github.com/desiria-ja/desiria-product-csv-guard/blob/e19010a5a371307a1f41559fe87f2d098c00daf6/demo/products-before.csv | MIT | 2026-10-27 | `9cbb74e56ae75cd320a4ea70e403607e11cc1ac3f1a9d1e11a58529d47207699` |
| `files/desiria-products-after.csv` | https://github.com/desiria-ja/desiria-product-csv-guard/blob/e19010a5a371307a1f41559fe87f2d098c00daf6/demo/products-after-risky.csv | MIT | 2026-10-27 | `a2b64d8479d43eb3ae2bd89b57a617d18fd2ba7d7a4862c722c1761b399719b1` |
| `files/dkautomation-matrixify-import.csv` | https://github.com/dkautomation23/feed-to-matrixify/blob/33eb291f6597d5e1ca02617319862bf814badd9d/sample/out/matrixify-import.csv | MIT | 2026-10-27 | `c0e717e4fff4c7f6fc4d667a27b8dc7fda1f351326e3f5cca57080aeeeb65c34` |
| `files/heiguang-shopify-import.csv` | https://github.com/heiguang2022/ecommerce-product-data-automation/blob/15b1b996f21f323bcb64f883e99713a3c43a181c/data/output/shopify_import.csv | MIT | 2026-10-27 | `8a500bd02159bda759d4c5e5bf268e0eb42e73cbeb080fbb7c415a2c756637af` |
| `files/heiguang-product-template.csv` | https://github.com/heiguang2022/ecommerce-product-data-automation/blob/15b1b996f21f323bcb64f883e99713a3c43a181c/data/reference/shopify_product_template.csv | MIT | 2026-10-27 | `97b3d4a6a479485ad2685069db18c4039acc163f614691962bae798102ca17ad` |
| `files/heiguang-woocommerce-shopify-import.csv` | https://github.com/heiguang2022/ecommerce-product-data-automation/blob/15b1b996f21f323bcb64f883e99713a3c43a181c/data/output/woocommerce_official/shopify_import.csv | MIT | 2026-10-27 | `9a4e4dc1f6541b7a34e8d84ce33c491f57fb05c24880b523c77ff7f9033edf59` |
| `files/ianbertoni-shopify-products.csv` | https://github.com/IanBertoni/freelance-data-demos/blob/daca94f8014ec9070a6bde743cedf5ff38d1dca7/data/output/shopify_products.csv | MIT | 2026-10-27 | `67c1878dc28d5483d789d338b1a3c955cd85f7dccb5481e2a983e0eb79fd267d` |
| `files/icekree-safe-copy.csv` | https://github.com/icekree/million-revenue-os/blob/a11f3edd5da9dc14fcbee155d85811bc9e8f8d1d/public/shopify-csv-audit-sample/human-reviewed-safe-copy.csv | MIT | 2026-10-27 | `349822a589fd9e2f423cd7ee086deb0218024a6860c6929c8b27e82285e8a648` |
| `files/jaweria-import-ready.csv` | https://github.com/jaweriaumair653-gif/shopify-bulk-import-standardization/blob/42a449ddc17cd610a59fb53743816af9afc24ab6/shopify_import_ready.csv | MIT | 2026-10-27 | `b6638c6501125a3e8c6d53a8cd986eecee9653ed666684637a3dd9381834748f` |
| `files/joomni-export-sample.csv` | https://github.com/joomni/joomni-csv-product-import/blob/dbbd1672543b85df5ae00bca339af4e1dd5f1393/examples/shopify-export-sample.csv | MIT | 2026-10-27 | `df88ac9b18342d22f290c6756226e5610bd1079ced6278c897078aadf68e0031` |
| `files/mbilal-sample-export.csv` | https://github.com/MBilal42/shopify-pricing-sync/blob/66c3e1834b5004537f6f4c5c1fe7c9c81ed99fd1/sample-data/sample-shopify-export.csv | MIT | 2026-10-27 | `bc4cf2c469eee91bcf430bb912095782c79d70cc1412232e9ac59d96ca39050f` |
| `files/natsuki-valid-products.csv` | https://github.com/NatsukiHa/shopify-product-audit/blob/d6fa88e0b279f3dc6839decb5f06fb4fc643b5cf/examples/valid-products.csv | MIT | 2026-10-27 | `4f45e35a26ef5fba1193f984175eb61db6a112e62a66a16c1bea52c3cae9f1d2` |
| `files/natsuki-invalid-products.csv` | https://github.com/NatsukiHa/shopify-product-audit/blob/d6fa88e0b279f3dc6839decb5f06fb4fc643b5cf/examples/invalid-products.csv | MIT | 2026-10-27 | `1a4f78cccdce1d66fd7888278b16c36672206e01b3898875579f3e0ad5af9061` |
| `files/nsollazzo-product-template.csv` | https://github.com/nsollazzo/woo-shopify/blob/14a510e67cbe9c0507062e79c3cc8c544cf097de/csv/input/product_template.csv | MIT | 2026-10-27 | `5b7167f07b88e592d1c2ef95403617617c4bd8684f8dcdd6b5859c3833e60076` |
| `files/reelsmith-products.csv` | https://github.com/reelsmith/shopcsv/blob/2406ec8c81c466c8fe837646abfe4b48c9b2c1fc/examples/products.csv | MIT | 2026-10-27 | `631364e4fe43701f4e5b7f7bf3bf2971588505e94f3605ff2310a76e4640aad3` |
| `files/schemamap-products-complete.csv` | https://github.com/codebruinc/schemamap/blob/45680551f47d1ea1d75a219800255d8bf9e9dee2/packages/engine/test-fixtures/golden/shopify-products-complete.csv | MIT | 2026-10-27 | `270fd9e3f481134e20f94c9cd4a9e2b9027828b422ae9cff4ea43f886684b88c` |
| `files/schemamap-products-minimal.csv` | https://github.com/codebruinc/schemamap/blob/45680551f47d1ea1d75a219800255d8bf9e9dee2/packages/engine/test-fixtures/golden/shopify-products-minimal.csv | MIT | 2026-10-27 | `f36eb515a20abd90c0b88c793d9ac3d4e33e70e9566fad085a128ab88a4224c4` |
| `files/schemamap-products-bad-price.csv` | https://github.com/codebruinc/schemamap/blob/45680551f47d1ea1d75a219800255d8bf9e9dee2/packages/engine/test-fixtures/red/shopify-products-bad-price.csv | MIT | 2026-10-27 | `8e54797716cdec1bb11121b5c1e7380d73ba18d9ff650135cba5c9d873e97181` |
| `files/schemamap-sample-data.csv` | https://github.com/codebruinc/schemamap/blob/45680551f47d1ea1d75a219800255d8bf9e9dee2/sample-data/shopify-products.csv | MIT | 2026-10-27 | `4350c446249080774b5936de971c0344af2c9e13c2f44f6d5ca612c68ebbff9c` |
| `files/stockproof-products.csv` | https://github.com/arthi-arumugam-git/stockproof/blob/a17e5de58cb3c0ece7b6a5acdc4e457008e4e156/site/sample/products.csv | MIT | 2026-10-27 | `3faa6017b942389f47e5cf41452f9ff76922a3f43274d2a8a73aa926417b6cd1` |
| `files/zhigerisen-products.csv` | https://github.com/Zhigerisen/google-shopping-feed-converter/blob/382e026db1af7a6e4b50b459ee4016d470388049/shopify_products.csv | MIT | 2026-10-27 | `3172bc520ada7890b0873c690474a6f6878d9e1e400c483f4cba653e29ad941d` |

## Unclear licence

These files are public product CSVs. The repositories do not state a licence that allows redistribution (`shopifypartners/product-csvs` has no licence, and `shopifypartners/shopify-product-csvs-and-images` says its images are for private use). Nothing from them is committed. `node scripts/fetch-corpus.mjs` downloads them into `corpus/cache/` and checks the sha256. That script is not part of `npm test`.

| URL | sha256 |
| --- | --- |
| https://raw.githubusercontent.com/shopifypartners/product-csvs/045fb432d85dc59d558717208399176d62bf106d/apparel.csv | 90291acf9147ab2eeccb7ead518bb5b3dd8900f7285b8cea918403e732c451b3 |
| https://raw.githubusercontent.com/shopifypartners/product-csvs/045fb432d85dc59d558717208399176d62bf106d/home-and-garden.csv | 97ebc4140c67c05b35de78f55f555fc3bd0e5ee70558ae2cd4cc141eaddf8d02 |
| https://raw.githubusercontent.com/shopifypartners/product-csvs/045fb432d85dc59d558717208399176d62bf106d/jewelery.csv | 92ed726816ef3f84be43a5b43a8a8faf358dd7584277258d85788e1eed549aa9 |
| https://raw.githubusercontent.com/shopifypartners/shopify-product-csvs-and-images/b77d80a47864787d57c2b73399650210679b037a/csv-files/apparel.csv | 41c85e84378793b95c816e340002cb9d0c3ff7b312dc23130753a54df0c60ba3 |
| https://raw.githubusercontent.com/shopifypartners/shopify-product-csvs-and-images/b77d80a47864787d57c2b73399650210679b037a/csv-files/bicycles.csv | ec16655e2af7a5c6a5e21639367e62ba678a315bcc7284d979c057a6b4337c65 |
| https://raw.githubusercontent.com/shopifypartners/shopify-product-csvs-and-images/b77d80a47864787d57c2b73399650210679b037a/csv-files/fashion.csv | 17ea57f1a1b526ba438432a7c87dd3fecb6366213679bc175f8a28a814068e52 |
| https://raw.githubusercontent.com/shopifypartners/shopify-product-csvs-and-images/b77d80a47864787d57c2b73399650210679b037a/csv-files/jewelry.csv | 46cdd595b5d18f6f570689de1ca3ff32039d03873b730199e76f6118f4ae67f1 |
| https://raw.githubusercontent.com/shopifypartners/shopify-product-csvs-and-images/b77d80a47864787d57c2b73399650210679b037a/csv-files/snowdevil.csv | 6c4ace916ad4d22eb6bd99b12e3af81f5b77fc8a6b9044346ffa694c3960bcf2 |
