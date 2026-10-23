---
# Allowed version bumps: patch, minor, major
site-history: minor
---

Added the permission `viewSiteHistory` for the Site history page. The `site-administrator` and `server-administrator` roles hold it by default.

A user who holds only `viewHistoryTab`, the permission of the History tab of a node, does not see the Site history page. To give another role access, grant it `viewSiteHistory`.
