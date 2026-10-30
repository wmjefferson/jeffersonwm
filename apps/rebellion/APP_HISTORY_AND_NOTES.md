# Application Architecture, Removed Features & Historical Archive

This document provides a comprehensive, detailed architectural reference of all features that have been removed or simplified from the application. If you ever want to re-integrate or reference these capabilities in the future, all design patterns, schemas, endpoints, and frontend integration code are archived below.

---

## 1. Import & Export Features Archive

### 1.1 JSON Document Import & Export
- **Purpose**: Full offline document portability to save the workspace state (titles, standard committed notes, highlighted notes) to a client-side JSON file and rehydrate state upon upload.
- **Data Payload Structure**:
  ```json
  {
    "titles": ["Exploring the Digital Void", "Secondary Subtitle"],
    "committedStandard": [
      {
        "text": "Regular note paragraph content...",
        "isSpecial": false,
        "fontSize": "medium",
        "fontFamily": "serif",
        "isBold": false,
        "isItalic": false
      }
    ],
    "committedSpecial": [
      {
        "text": "Highlighted note paragraph content...",
        "isSpecial": true,
        "fontSize": "medium",
        "fontFamily": "serif",
        "isBold": true,
        "isItalic": false
      }
    ],
    "version": 1
  }
  ```
- **Implementation Code**:
  ```typescript
  // Export JSON
  const handleExportJSON = () => {
    const data = {
      titles,
      committedStandard,
      committedSpecial,
      version: 1
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titles[0] || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.titles) setTitles(json.titles);
        if (json.committedStandard) setCommittedStandard(json.committedStandard);
        if (json.committedSpecial) setCommittedSpecial(json.committedSpecial);
      } catch (err) {
        console.error('Invalid JSON format', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  ```

### 1.2 PDF Document Generation
- **Purpose**: Client-side compiled PDF output preserving document titles, margins, page wrapping, and color distinctions between standard and highlighted notes.
- **Dependencies**: `jspdf`
- **Implementation Code**:
  ```typescript
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let yOffset = 20;

      // Render Titles
      doc.setFontSize(22);
      titles.forEach(t => {
        doc.text(t, 20, yOffset);
        yOffset += 12;
      });

      yOffset += 10;
      doc.setFontSize(12);

      const allNotes = [
        ...committedStandard.map(p => ({ ...p, isSpecial: false })),
        ...committedSpecial.map(p => ({ ...p, isSpecial: true }))
      ];

      allNotes.forEach(note => {
        // Highlighted text rendered in a distinct red/accent tone
        if (note.isSpecial) {
          doc.setTextColor(150, 0, 0);
        } else {
          doc.setTextColor(0, 0, 0);
        }

        const splitText = doc.splitTextToSize(note.text, 170);
        if (yOffset + (splitText.length * 6) > 280) {
          doc.addPage();
          yOffset = 20;
        }

        doc.text(splitText, 20, yOffset);
        yOffset += (splitText.length * 6) + 4;
      });

      doc.save(`${titles[0] || 'document'}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF', err);
    } finally {
      setIsExporting(false);
    }
  };
  ```

---

## 2. Remote Database & MySQL Integration Archive

### 2.1 MySQL Connection Manager & Local Storage
- **Purpose**: Configurable remote MySQL targets with credential testing, encrypted passwords UI masking, SSL support, and multi-host switching.
- **Connection Configuration Interface**:
  ```typescript
  interface MySqlConnectionConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    user: string;
    password?: string;
    database?: string;
    useSsl: boolean;
  }
  ```
- **Backend Connection Helper (`mysql2/promise`)**:
  ```typescript
  const getDbConnection = async (configRef: any, overrideDatabase?: string) => {
    const connection = await mysql.createConnection({
      host: configRef.host,
      port: Number(configRef.port || 3306),
      user: configRef.user,
      password: configRef.password,
      database: overrideDatabase || configRef.database || undefined,
      ssl: configRef.useSsl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 8000,
    });
    return connection;
  };
  ```

### 2.2 Backend API Routes for Database Management

#### A. Connection Ping / Verification
- **Endpoint**: `POST /api/mysql/test-connection`
- **Request Body**: `{ connectionConfig: MySqlConnectionConfig }`
- **Behavior**: Opens socket, runs `.ping()`, tests network reachability and authentication.

#### B. Auto-Provisioning Notes Table
- **Endpoint**: `POST /api/mysql/create-notes-table`
- **Request Body**: `{ connectionConfig, targetDb, tableName: "app_notes" }`
- **SQL Schema**:
  ```sql
  CREATE TABLE IF NOT EXISTS `app_notes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `doc_title` VARCHAR(255) DEFAULT 'Untitled Document',
    `text_content` TEXT,
    `is_highlighted` TINYINT(1) DEFAULT 0,
    `font_family` VARCHAR(50) DEFAULT 'sans',
    `font_size` VARCHAR(50) DEFAULT 'medium',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### C. Bulk Transmit Notes
- **Endpoint**: `POST /api/mysql/send-notes`
- **Request Body**:
  ```json
  {
    "connectionConfig": { ... },
    "targetDb": "app_db",
    "table": "app_notes",
    "docTitle": "Exploring the Digital Void",
    "notes": [
      { "text": "Paragraph 1", "isSpecial": false, "fontFamily": "serif", "fontSize": "medium" },
      { "text": "Paragraph 2", "isSpecial": true, "fontFamily": "serif", "fontSize": "medium" }
    ]
  }
  ```
- **Insert Query Execution**:
  ```sql
  INSERT INTO `app_notes` (`doc_title`, `text_content`, `is_highlighted`, `font_family`, `font_size`)
  VALUES (?, ?, ?, ?, ?);
  ```

---

## 3. Advanced Schema Exploration & SQL Runner (Previous Iterations)

The earlier iteration of the database toolkit also contained:
1. **Dynamic Database Listing (`POST /api/mysql/databases`)**: Ran `SHOW DATABASES` to populate dropdowns with available schemas on the server.
2. **Table & Column Inspector (`POST /api/mysql/tables`, `POST /api/mysql/columns`)**: Queried `INFORMATION_SCHEMA.COLUMNS` to show field names, types, nullability, and primary keys.
3. **Database-Wide Schema Map (`POST /api/mysql/db-schema-all`)**: Aggregated table-by-table column definitions into an interactive accordion tree.
4. **Column Mapping Engine**: Allowed users to map custom database column names (e.g. `body_text` instead of `text_content`, `flag_featured` instead of `is_highlighted`).
5. **Interactive SQL Runner & Console (`POST /api/mysql/query`)**: Provided an in-browser terminal and SQL syntax textarea with execution timers, error formatting, and a dynamic table output grid for `SELECT` queries.

---

## Summary of Active Application Scope

With these features removed, the application is streamlined to its core purpose:
- **Fast, distraction-free document and note creation**.
- **Interactive typography controls** (Font Family: Serif, Sans, Mono, System; Font Size: Small, Medium, Large, X-Large; Weight/Style: Bold, Italic; Line Spacing: Short, Medium, Wide).
- **Directional Insertion** (Add to Bottom or Add to Top).
- **Rich Media & File Attachment Support** (Drag-and-drop or paste images and files directly into paragraphs).
- **Two-Column Workflow**: Draft/builder column on the left with instant inline paragraph editing, and committed dual-stream lists (Standard Text & Highlighted/Special Text) on the right with single-click and batch copying.

