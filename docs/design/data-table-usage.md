# Data table usage

```tsx
<DataTable
  columns={columns}
  data={rows}
  getRowId={(row) => row.id}
  enableSearch
/>
```

Server mode:

```tsx
<DataTable
  mode="server"
  columns={columns}
  data={page.rows}
  getRowId={(row) => row.id}
  server={{ query, totalCount: page.totalCount, onQueryChange: setQuery }}
/>
```

Sortable headers use `DataTableColumnHeader`. Status cells should use `StatusBadge` text, not color alone. Debounce search in the parent before changing a server query. Drop responses whose request id is older than `isStaleRequest`.
