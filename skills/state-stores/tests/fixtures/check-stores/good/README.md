The good case of check-stores runs on the skill's own templates/ folder (see scripts/selftest.mjs),
so the templates are proven to pass the checker every time the self-test runs.
Every case is assembled in a temporary folder by scripts/lib/fixture-tree.mjs: the templates, then
the case folder on top. Each bad-* folder therefore holds only the file(s) with its planted bug
(REMOVE.txt deletes a path instead) and EXPECT.txt.
