const fs = require('fs');
const path = require('path');
const express = require('express');

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

const splitEntryByMidnightWithReasonStatus = (entry) => {
    const start = new Date(entry.start_time);
    const end = new Date(entry.end_time);

    // Check if the time spans midnight
    if (start.getDate() !== end.getDate()) {
        const midnight = new Date(start);
        midnight.setHours(24, 0, 0, 0); 

        return [
            {
                Equipment: entry.equipment_id,
                Start_Time: formatDate(entry.start_time),
                End_Time: formatDate(midnight),
                // Source: entry.source,
                Status: entry.status,
                Reason: entry.reason,
            },
            {
                Equipment: entry.equipment_id,
                Start_Time: formatDate(midnight),
                End_Time: formatDate(entry.end_time),
                // Source: entry.source,
                Status: entry.status,
                Reason: entry.reason,
            },
        ];
    }
    
    return [
        {
            Equipment: entry.equipment_id,
            Start_Time: formatDate(entry.start_time),
            End_Time: formatDate(entry.end_time),
            // Source: entry.source,
            Status: entry.status,
            Reason: entry.reason,
        },
    ];
};

const splitEntryByMidnight = (entry) => {
    const start = new Date(entry.start_time);
    const end = new Date(entry.end_time);

    // Check if the time spans midnight
    if (start.getDate() !== end.getDate()) {
        const midnight = new Date(start);
        midnight.setHours(24, 0, 0, 0); 

        return [
            {
                Equipment: entry.equipment_id,
                Start_Time: formatDate(entry.start_time),
                End_Time: formatDate(midnight),
                Status: entry.status,
            },
            {
                Equipment: entry.equipment_id,
                Start_Time: formatDate(midnight),
                End_Time: formatDate(entry.end_time),
                Status: entry.status,
            },
        ];
    }

    return [
        {
            Equipment: entry.equipment_id,
            Start_Time: formatDate(entry.start_time),
            End_Time: formatDate(entry.end_time),
            Status: entry.status,
        },
    ];
};
function aggregateData(data) {
    const aggregatedResults = new Map();

    data.forEach(entry => {
        // console.log(entry)
        // ONly agregate down
        if(entry.Status == "DOWN"){
            const equipmentId = entry.Equipment;
            const tempdate = new Date(entry.Start_Time);

            // Extract just the year, month, and day to group by date
            const year = tempdate.getFullYear();
            const month = String(tempdate.getMonth() + 1).padStart(2, '0');
            const day = String(tempdate.getDate()).padStart(2, '0');
            
            const date = `${year}-${month}-${day}`


            const reason = entry.Reason;
            console.log(entry.Start_Time)
            // group by equipment, date, and reason
            const key = `${equipmentId}|${date}|${reason}`;

            if (!aggregatedResults.has(key)) {
                aggregatedResults.set(key, { equipmentId, date, reason, totalOccurrence: 0 });
            }

            aggregatedResults.get(key).totalOccurrence++;
        }
        
    });

    // Convert map values to an array for final result
    return Array.from(aggregatedResults.values());
}

module.exports = {
    loadJsonData,
    parseTimestamps,
    formatDate,
    splitEntryByMidnightWithReasonStatus,
    splitEntryByMidnight,
    aggregateData
};