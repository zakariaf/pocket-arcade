The good case adds nothing: it is this skill's templates/ plus tests/fixtures/support/ (the
progress reducer that run-end.ts imports), assembled in a temporary folder by
scripts/lib/fixture-tree.mjs. Each bad-* folder holds only the file(s) with its planted bug
(REMOVE.txt deletes a path instead) and EXPECT.txt.
