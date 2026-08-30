// Archived staging reference.
//
// This folder is retained only as a UI/history checkpoint from the widget
// migration period. The live JeffersonWM widget stack now runs from
// apps/jeffersonwm/server.ts against the JeffersonWM-owned widget tables.
//
// If a future rebuild is needed, restore data from backups and use the current
// JeffersonWM widget schema instead of recreating the retired standalone
// source databases.

throw new Error(
  'widget_staging_reference/server.ts is archived only. Use apps/jeffersonwm/server.ts for the live JeffersonWM widget API.'
);
