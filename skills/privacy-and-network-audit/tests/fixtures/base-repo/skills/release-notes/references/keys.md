# Keys (a skill's own docs inside the repo)

Before a release, `git grep -n "BEGIN PRIVATE KEY"` must find nothing, and `git log -p -S "PRIVATE KEY-----"`
must show no commit that ever held key material. Prose that names the marker is not a key.
