const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Load JSON
function loadJsonData(filename) {
    const filePath = path.join(__dirname, filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Convert ts to Date objects
function parseTimestamps(entry) {
    return {
        ...entry,
        start_time: new Date(entry.start_time),
        end_time: new Date(entry.end_time),
    };
}

// Format date
function formatDate(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    if (isNaN(date)) {
        throw new Error("Invalid date format");
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// Merge data for a n equipment
function tempMergeData(statusData, manualData) {
    // TODO : this is a working but really bad impelemntation, have n^2 complexites should be able to make it n*logn
    let combinedData = [
        ...statusData.map(entry => ({ ...entry, source: 'status', reason: "Status Down" }))
    ];

    manualData.forEach(manualEntry => {
        let manualStart = new Date(manualEntry.start_time);
        let manualEnd = new Date(manualEntry.end_time);
        let updatedCombinedData = [];

        combinedData.forEach(statusEntry => {
            let statusStart = new Date(statusEntry.start_time);
            let statusEnd = new Date(statusEntry.end_time);

            if (manualEnd < statusStart || manualStart > statusEnd) {
                // No overlap, keep the original status 
                updatedCombinedData.push(statusEntry);
            } else {
                // Overlap : split the status entry if necessary
                if (statusStart < manualStart) {
                    // Add the non-overlapping part before the manual entry
                    updatedCombinedData.push({
                        ...statusEntry,
                        end_time: manualStart.toISOString(),
                    });
                }

                if (statusEnd > manualEnd) {
                    // Add the non-overlapping part after the manual entry
                    updatedCombinedData.push({
                        ...statusEntry,
                        start_time: manualEnd.toISOString(),
                    });
                }
            }
        });

        // Add the manual entry with its unique time interval
        updatedCombinedData.push({
            ...manualEntry,
            source: 'manual',
        });

        // Replace combinedData 
        combinedData = updatedCombinedData;
    });

    // Sort the final combined data by start_time
    return combinedData.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}


// Merge data for all equipment
function mergeData(statusData, manualData) {
    const equipmentIds = [...new Set([...statusData, ...manualData].map(entry => entry.equipment_id))];
    let mergedData = [];

    equipmentIds.forEach(equipmentId => {
        const statusForEquipment = statusData.filter(entry => entry.equipment_id === equipmentId);
        const manualForEquipment = manualData.filter(entry => entry.equipment_id === equipmentId);
        const tempMerged = tempMergeData(statusForEquipment, manualForEquipment);
        mergedData = mergedData.concat(tempMerged);
    });

    return mergedData;
}

app.get('/data', (req, res) => {
    const statusData = loadJsonData('status.json').map(parseTimestamps);
    const manualData = loadJsonData('manual_status.json').map(parseTimestamps);

    const mergedData = mergeData(statusData, manualData).sort((a, b) => {
        if (a.equipment_id !== b.equipment_id) {
            return a.equipment_id - b.equipment_id;
        }
        return a.start_time - b.start_time;
    });

    const result = mergedData.map(entry => ({
        Equipment: entry.equipment_id,
        Start_Time: formatDate(entry.start_time),
        End_Time: formatDate(entry.end_time),
        Source: entry.source,
        Status: entry.status,
        Reason: entry.reason,
    }));

    console.log("Merged result length:", result.length);
    res.json(result);
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/data`);
});
