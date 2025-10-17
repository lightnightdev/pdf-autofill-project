BUGS
- Clear All Markers not clearing render
- Need parseApiData!
- When uploading PDF & CSV files, check if both are loaded, If so, run the script that closes menu 1 and opens menu 2 and menu 1 (if >1pg)
- When uploading JsonData, re-render the csvCards and customTextcards too

QUALITY OF LIFE

- Reorganize Buttons to match user workflow
    -Choosing Files (choose files, download files, delete files)
        * Set carrier name?
    -Editing File
        PDF: (page nav, rmv page, reset markers)
            If only one page, close PDF Navigation, open Marker Data
        Markers: Upload marker data for CSV file!
    -Finish File
        Generate + options
        Save for future: Server or Download

- Enable downloading the CSV template with headers only

FEATURES:

- Implement Upload/Download from Server
    - Enable carrier name UPLOADING to Server
    - Enable DOWNLOADING from Server
    - Display Upload Data as Table instead of raw JSON
    - Only suppress keys if a LocEl is selected - unselect loc-el when opening Modal

- Allow user to upload Font, store in IndexedDB, and reference it
    - Will need to process STypoAscender and STypoDescender from Font

- Allow "Wet Signature" link generation (API side).
    Basically, generate a link that we can send to the client to Sign with their finger or mouse.


REFACTOR:
- Refactor LocData to be like customText: LocData[pageNum]
    - Do not bind ids to column ids!!! add column ID as element
    - When doubling a column, utilize this. column ID
- Combine _data_customText and data_markers and data_savedText. Or, make a markers_util that streamlines a lot of functionality


- Streamline Render pipeline:
    - PDF State (currentPdfBytes, file name, etc.)
        - Render State (Rasterized Elements)
            - Individual Page
                ColumnText(LocData)
                    Individual Page Elements
                    Individual Page Elements
                    ...
                CustomText/SavedText
                    Individual Page Elements
                    Individual Page Elements
                    ...