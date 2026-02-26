# .atdb File Format Documentation

## Overview
The `.atdb` format is used by the "Древо Жизни 6" (Agelong Tree 6) genealogy software. Despite appearances of being a proprietary binary format, `.atdb` files are actually uncompressed SQLite databases with a specific structure and schema.

## Database Structure

### Primary Tables
- **Persons**: Contains information about individuals
- **Families**: Contains information about family units
- **Events**: Contains information about various life events

### Metadata Tables
- **Global**: Contains database metadata and version information
- **Fields**: Contains field definitions that map field IDs to their meanings

### Data Storage Tables
- **ValuesStr**: Stores string values (names, places, notes)
- **ValuesNum**: Stores numeric values
- **ValuesDates**: Stores date values
- **ValuesLinks**: Stores relationships between records
- **EventDetails**: Links persons to events and event roles
- **EventRoles**: Defines types of events
- **Places**: Stores location information

## Table Details

### Persons Table
Contains the main information about individuals in the genealogy tree.

**Fields:**
- `id`: Unique identifier for the person
- `sex`: Gender of the person (0=Unknown, 1=M, 2=F)
- Additional fields like first name, last name, and patronymic may be stored in ValuesStr table

### Families Table
Contains family unit information.

**Fields:**
- `id`: Unique identifier for the family
- `color`: Color code for visual representation in the software

### Events Table
Contains historical events related to persons or families.

**Fields:**
- `id`: Unique identifier for the event
- `et_id`: Event type identifier

### EventDetails Table
Links persons to events and defines the role of each person in the event.

**Fields:**
- `p_id`: Person ID (links to a person)
- `e_id`: Event ID (links to an event)
- `er_id`: Event Role ID (links to an event type in EventRoles table)
- `p_ord`: Order of person in the event (determines primary person for date/place associations)

### Global Table (Metadata)
Contains database metadata information.

**Fields:**
- `version`: Database schema version
- `guid`: Global unique identifier for the database
- `srcguid`: Source GUID (if database was imported/derived from another)
- `mainlang`: Main language of the database
- `params`: Additional parameters

### Fields Table
Contains field definitions that map field IDs to their meanings and which table they belong to.

**Fields:**
- `id`: Field identifier
- `tablecode`: Code indicating which table the field belongs to
- `area`: Name of the field

### Values Tables
The database uses four tables to store values: ValuesStr, ValuesNum, ValuesDates, and ValuesLinks.

**ValuesStr** (String Values)
- `f_id`: Field identifier
- `rec_table`: Code of the table the record belongs to
- `rec_id`: Record identifier 
- `vstr`: String value

**ValuesNum** (Numeric Values)
- `f_id`: Field identifier
- `rec_id`: Record identifier
- `vnum`: Numeric value

**ValuesDates** (Date Values)
- `f_id`: Field identifier
- `rec_table`: Code of the table the record belongs to
- `rec_id`: Record identifier
- `y`: Year
- `m`: Month
- `d`: Day

**ValuesLinks** (Relationships)
- `f_id`: Field identifier
- `rec_table`: Code of the table the source record belongs to
- `rec_id`: Source record identifier
- `vlink_table`: Code of the table the linked record belongs to
- `vlink_id`: Linked record identifier

## Field ID Mappings
Based on analysis of the implementation and debug logs, common field IDs have the following meanings:

### Person-related Fields (table code 13)
- `1`: First name (fname)
- `2`: Last name (lname)
- `3`: Patronymic
- `4`: Birth place
- `5`: Death place
- `6`: Notes

### Family-related Fields (table code 9 for Families, according to requirements)
- `48`: Husband last name
- `49`: Wife last name
- `50`: Family name
- `52`: Comment

### Event-related Fields (table code 11)
- `1`: Person ID associated with the event
- `2`: Family ID associated with the event
- `3`: Event date
- `4`: Event place
- `5`: Event description

### EventDetails-related Fields (table code 7)
- `p_id`: Person ID (links to a person)
- `e_id`: Event ID (links to an event)
- `er_id`: Event Role ID (1 = person being born, 2 = father, 3 = mother)

## Table Code Mappings
- `7`: EventDetails table (for date values in the EventDetails context)
- `9`: Families table
- `11`: Events table
- `13`: Persons table
- `14`: Places table

## Data Parsing Considerations

### String Values
Names and other text values can be stored in multiple ways:
1. In the Persons table columns (for basic info)
2. In the ValuesStr table using field definitions in the Fields table
3. In the ValuesStr table using standard field IDs (commonly with tableCode 13)

### Place Information
Location information is stored in the Places table and connected to persons through the Events system:
- Places are stored in the **Places** table (table code 14)
- Place details are stored in ValuesStr with rec_table = 14
  - Field ID 93: Place name
  - Field ID 94: Short name
  - Field ID 104: Comment
- Places are linked to persons through events (birth/death) via:
  - EventDetails.e_id connects to ValuesLinks.rec_id
  - ValuesLinks.rec_table = 7 (EventDetails)
  - ValuesLinks.vlink_table = 14 (Places) to indicate it's a place link
  - ValuesLinks.vlink_id = Places.id to specify which place
- Event type is determined by EventDetails.er_id → EventRoles.id → EventRoles.et_id (1 for birth, 2 for death)

### Date Values
Dates are stored in the ValuesDates table with separate year, month, and day columns. The field IDs determine what the date represents (birth, death, marriage, etc.).

### Relationships
Family relationships are stored in the ValuesLinks table and are critical to understanding the genealogical structure:

#### Person Relationships
Person relationships are stored with `rec_table` = 9 (Persons) and use the following field IDs:
- `9`: Father ID (links to another person)
- `10`: Mother ID (links to another person)
- `153`: Alternative Father ID (links to another person)
- `154`: Alternative Mother ID (links to another person)

#### Family Relationships
Family relationships are stored with `rec_table` = 13 (Families) and use the following field IDs:
- `1`: Husband ID (links to a person)
- `2`: Wife ID (links to a person)
- `3`: Child ID (links to a person - can have multiple records)

#### Event Relationships
Event relationships are stored with `rec_table` = 11 (Events) and use the following field IDs:
- `1`: Person ID associated with the event (links to a person) - this is an older method, use EventDetails for comprehensive data
- `2`: Family ID associated with the event (links to a family) - this is an older method, not used in new implementation

#### Event Details
Event details are stored in a separate table that links persons to events and event roles:
- **EventDetails Table**: Links persons to events and event roles
  - `p_id`: Person ID (links to a person)
  - `e_id`: Event ID (links to an event)
  - `er_id`: Event Role ID (links to an event type in EventRoles table)

- **EventRoles Table**: Defines types of events
  - `id`: Event Role ID (links to EventDetails.er_id)
  - `et_id`: Event Type ID (common values)
    - 1 = Рождение (Birth)
    - 2 = Смерть (Death)
    - 3 = Свадьба (Marriage)
    - 4 = Развод (Divorce)
    - 5 = Венчание (Wedding ceremony)
    - 34 = Захоронение (Burial)
    - 35 = Крестильни (Baptism)
    - 40 = Переезд (Moving)
    - 41 = Именины (Name Day)
    - 42 = Коммунальный праздник (Communal Holiday)
    - 43 = День рождения (Birthday)
    - 44 = Юбилей (Anniversary)
    - 50 = Обручение (Engagement)
    - 51 = Союз (Union)
    - 52 = Расставание (Separation)
    - 53 = Помолвка (Betrothal)
    - 54 = Усыновление (Adoption)
    - 55 = Развод (Divorce)
    - 56 = Вдовство (Widowhood)
    - 60 = Образование (Education)
    - 61 = Начало обучения (Start of Education)
    - 62 = Окончание обучения (End of Education)
    - 63 = Диплом (Diploma)
    - 64 = Ученая степень (Academic Degree)
    - 65 = Ученое звание (Academic Title)
    - 70 = Профессия (Profession)
    - 71 = Работа (Work)
    - 72 = Должность (Position)
    - 73 = Увольнение (Dismissal)
    - 74 = Переезд на работу (Job-related move)
    - 75 = Отставка (Resignation)
    - 80 = Военная служба (Military Service)
    - 81 = Звание (Rank)
    - 82 = Увольнение с военной службы (Discharge from Military)
    - 83 = Награда (Award)
    - 84 = Участие в конфликте (Conflict Participation)
    - 90 = Религиозные события (Religious Events)
    - 91 = Крещение (Baptism)
    - 92 = Исповедь (Confession)
    - 93 = Причастие (Communion)
    - 94 = Миропомазание (Anointing)
    - 95 = Катехизация (Catechism)
    - 96 = Конфирмация (Confirmation)
    - 97 = Сан (Holy Order)
    - 98 = Посвящение (Ordination)
    - 99 = Распоповление (Defrocking)
    - 100 = Медицинские события (Medical Events)
    - 101 = Беременность (Pregnancy)
    - 102 = Аборт (Abortion)
    - 103 = Усыновление (Adoption)
    - 104 = Роды (Childbirth)
    - 105 = Патентование (Patenting)
    - 106 = Лечение (Treatment)
    - 107 = Заболевание (Disease)
    - 108 = Инвалидность (Disability)
    - 109 = Донорство (Donation)
    - 110 = Операция (Surgery)
    - 111 = Авария (Accident)
    - 112 = Отравление (Poisoning)
    - 113 = Попытка суицида (Suicide Attempt)
    - 114 = Суицид (Suicide)
    - 115 = Убийство (Murder)
    - 116 = Насилие (Violence)
    - 117 = Нападение (Assault)
    - 118 = Несчастный случай (Accident)
    - 119 = Катастрофа (Disaster)
    - 120 = Заключение (Imprisonment)
    - 121 = Покушение (Attempt)
    - 122 = Кража (Theft)
    - 123 = Разбой (Robbery)
    - 124 = Мошенничество (Fraud)
    - 125 = Нарушение (Violation)
    - 126 = Преступление (Crime)
    - 127 = Судимость (Criminal Record)
    - 128 = Арест (Arrest)
    - 129 = Содержание под стражей (Detention)
    - 130 = Уголовное преследование (Prosecution)
    - 131 = Вызов в суд (Court Summons)
    - 132 = Свидетельство (Testimony)
    - 133 = Обвинение (Accusation)
    - 134 = Обвинительный акт (Indictment)
    - 135 = Оправдательный приговор (Acquittal)
    - 136 = Обвинительный приговор (Conviction)
    - 137 = Наказание (Punishment)
    - 138 = Исполнение приговора (Execution of Sentence)
    - 139 = Помилование (Pardon)
    - 140 = Амнистия (Amnesty)
    - 141 = Прекращение преследования (Termination of Prosecution)
    - 142 = Переезд (Moving)
    - 143 = Иммиграция (Immigration)
    - 144 = Эмиграция (Emigration)
    - 145 = Репатриация (Repatriation)
    - 146 = Натурализация (Naturalization)
    - 147 = Гражданство (Citizenship)
    - 148 = Паспорт (Passport)
    - 149 = Виза (Visa)
    - 150 = Документы (Documents)
    - (Additional event types may exist in different databases)

Event data (dates and places) retrieval pathway:
- Events.id connects to EventDetails.e_id
- EventDetails.id (for the first person by p_ord) connects to ValuesDates.rec_id where rec_table = 7 (EventDetails table code)
- EventDetails.id (for the first person by p_ord) connects to ValuesLinks.rec_id where rec_table = 7 (EventDetails table code) and vlink_table = 14 (Places table) to get place information
- `ValuesDates.rec_table` = 7 (EventDetails table code)
- `ValuesLinks.rec_table` = 7 (EventDetails table code), `vlink_table` = 14 (Places table)

#### Extracting Parent Information from Birth Events
To extract father and mother IDs from birth events:
- Find the birth event for a person in `EventDetails` where `p_id` = person ID and `er_id` = 1 (meaning the person was born)
- Get the `e_id` (event ID) from that record
- Find all `EventDetails` records with that `e_id` where `er_id` = 2 (father) or `er_id` = 3 (mother)
- Use the `p_id` values from those records as `fatherId` and `motherId`

## Implementation Notes
The implementation uses sql.js to process .atdb files in the browser by treating them as SQLite databases. When parsing, the system reads all tables and maps the data using field definitions and standard field ID mappings to reconstruct Person, Family, and Event objects.

When building .atdb files, the system updates the appropriate values in these tables based on the input data, following the same field ID mappings.