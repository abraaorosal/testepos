# CEPM Historical Analytics Dashboard

Interactive analytical dashboard for exploring historical CEPM training data directly from an Excel workbook.

Although the repository still carries a legacy experimental name, the codebase is a structured React/TypeScript application with data parsing, filtering, aggregation and visualization.

## Core capabilities

- loads structured training data from Excel;
- filters by year and participating force;
- searches historical records;
- calculates completion and participation metrics;
- compares yearly results;
- ranks participating forces;
- visualizes trends with interactive charts.

## Technology stack

| Layer | Technologies |
| --- | --- |
| UI | React 18 |
| Language | TypeScript |
| Build | Vite |
| Charts | Recharts |
| Spreadsheet parsing | SheetJS / xlsx |
| Quality | ESLint |

## Data flow

```text
Excel workbook
     │
     ▼
Workbook parser
     │
     ▼
Typed CEPM records
     │
     ▼
Filtering + aggregation
     │
     ▼
KPIs and Recharts visualizations
```

## Running locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Engineering highlights

- spreadsheet-to-application data pipeline;
- derived metrics instead of hard-coded totals;
- typed domain model;
- memoized analytical transformations;
- interactive visualization of institutional history.

## Repository status

The repository name is a legacy name from the prototyping stage. The project itself is no longer a generic test and is better understood as an **academic/institutional analytics project**.

## Data responsibility

The workbook used by a public deployment should contain only data authorized for publication and should exclude personally identifiable or sensitive operational information.

---

**Portfolio classification:** secondary project · React · TypeScript · Excel analytics · data visualization
