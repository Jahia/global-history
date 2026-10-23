---
# Allowed version bumps: patch, minor, major
site-history: minor
---

Added a Content type column to the Site history table. The column shows the label of the primary type of the node in the UI language, and its icon. A row of a translation node shows the type of its content node, and the cell is empty when the node no longer exists.

The GraphQL type `SiteHistoryEntry` has a field `primaryNodeType` of type `JCRNodeType`.
