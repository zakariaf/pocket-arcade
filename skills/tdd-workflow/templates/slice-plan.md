# Slice: __BEHAVIOUR_IN_ONE_SENTENCE__

## Spec lines

- __SPEC_ID__: "__SPEC_QUOTE__" (printed with the product-spec lookup, not from memory)

## The behaviour

__WHAT_A_PLAYER_OR_THE_SHELL_CAN_OBSERVE_AFTERWARDS__

## First failing test

- File: `__TEST_FILE_PATH__`
- Title: `it('__THIRD_PERSON_VERB_TITLE__ (spec __SPEC_ID__)')`
- Expected red: an assertion diff (`Expected: __EXPECTED__`, `Received: __STUB_VALUE__`), not an import or type error.

## Files the code will touch

- `__SOURCE_FILE_PATH__`

## Layer and order

- Layer: __RULES_LEVELS_SAVE_SERVICE_HOOK_SCREEN_FLOW__ (everything this layer depends on is already tested)

## Evidence the slice needs

- [ ] Red run pasted (the assertion lines)
- [ ] Green run: `npx jest --ci __TEST_FILE_PATH__`
- [ ] Pure logic: examples + properties + one pinned exact value
- [ ] UI: screenshots in en and fa, light and dark, matched against the Toybox design screenshot
- [ ] `npm run -s check:fast` green
- [ ] Commit: `__TYPE__(__SCOPE__): __SUBJECT__` with the spec lines in the body

## Red run

```text
__PASTE_THE_ASSERTION_LINES_OF_THE_RED_RUN__
```
