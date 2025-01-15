const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

const {
    loadJsonData,
    parseTimestamps,
    splitEntryByMidnightWithReasonStatus,
    splitEntryByMidnight,
    aggregateData
} = require('./utils');

const {
    calculateAPQ,
    categorizeOEE
} = require('./OEECalculation')

// Merge data for current equipment
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
        console.log("===================", equipmentId, "===================")
        const statusForEquipment = statusData.filter(entry => entry.equipment_id === equipmentId);
        const manualForEquipment = manualData.filter(entry => entry.equipment_id === equipmentId);
        const tempMerged = tempMergeData(statusForEquipment, manualForEquipment);
        
        mergedData = mergedData.concat(tempMerged);

        console.log("statusForEquipment", equipmentId," length ", statusForEquipment.length)
        console.log("manualForEquipment", equipmentId," length ", manualForEquipment.length)
        console.log("Merged", equipmentId," length ", tempMerged.length)
        console.log("Merged cum length ", mergedData.length)
    });

    return mergedData;
}

app.get('/Downtimeaggregation', (req, res) => {
    // TODO : refactor 
    const statusData = loadJsonData('status.json').map(parseTimestamps);
    const manualData = loadJsonData('manual_status.json').map(parseTimestamps);
    // const statusData = loadJsonData('dummy_status.json').map(parseTimestamps);
    // const manualData = loadJsonData('dummy_manual_status.json').map(parseTimestamps);
    const mergedData = mergeData(statusData, manualData).sort((a, b) => {
        if (a.equipment_id !== b.equipment_id) {
            return a.equipment_id - b.equipment_id;
        }
        return a.start_time - b.start_time;
    });


    const result = aggregateData(mergedData.flatMap(splitEntryByMidnightWithReasonStatus));
    // const result = mergedData.flatMap(splitEntryByMidnightWithReasonStatus);

    console.log("Merged result length:", result.length);
    res.json(result);
});


app.get('/OEECalculation', (req, res) => {
    // Load JSON data    
    const statusData = JSON.parse(fs.readFileSync('status.json', 'utf8')).flatMap(splitEntryByMidnight);
    const productionData = JSON.parse(fs.readFileSync('production.json', 'utf8'));

    const equipmentIds =  Array.from(new Set(statusData.map(entry => entry.Equipment)));
    console.log(statusData);
    console.log("equipmentIds : " , equipmentIds);

    // // Calculate avg APQ each equipment
    const tempresults = {};

    // // A, P, Q can only be calculated for single equipment and single day.
    equipmentIds.forEach(equipmentId => {
        console.log("===================", equipmentId, "===================")
        // Filter  for the current equipment
        const equipmentStatusData = statusData.filter(entry => entry.Equipment === equipmentId);
        const equipmentProductionData = productionData.filter(entry => entry.equipment_id === equipmentId);

        // Avg APQ for a certain equipment for multiple day
        const res = calculateAPQ(equipmentStatusData, equipmentProductionData)
        tempresults[equipmentId] = {
            availability: res.availability,
            performance: res.performance,
            quality: res.quality,
        };
    });

    // A/P/Q multiple equipments and multiple days can be calculated as average A/P/Q for multiple days and after that average A/P/Q for multiple equipment.
    // Calculate Average for multiple equipment
    let totalAvailability = 0;
    let totalPerformance = 0;
    let totalQuality = 0;
    let validEquipmentCount = 0;

    equipmentIds.forEach(equipmentId => {
        const equipmentData = tempresults[equipmentId];
        if (equipmentData.availability > 0 || equipmentData.performance > 0 || equipmentData.quality > 0) {
            totalAvailability += equipmentData.availability;
            totalPerformance += equipmentData.performance;
            totalQuality += equipmentData.quality;
            validEquipmentCount++;
        }
    });

    // // Calculate averages multiple equipments and multiple days 
    const avgAvailability = validEquipmentCount > 0 ? totalAvailability / validEquipmentCount : 0;
    const avgPerformance = validEquipmentCount > 0 ? totalPerformance / validEquipmentCount : 0;
    const avgQuality = validEquipmentCount > 0 ? totalQuality / validEquipmentCount : 0;
    const oee = avgAvailability * avgPerformance * avgQuality;

    // A/P/Q multiple equipments and multiple days can be calculated as average A/P/Q for multiple days and after that average A/P/Q for multiple equipment.
    tempresults["AverageMultipleEquipmentMultipleDays"]  = {
        availability: avgAvailability,
        performance: avgPerformance,
        quality: avgQuality,
        oee: oee,
        category: categorizeOEE(oee)
    };

    // Return JSON response
    res.json(tempresults);
});



app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
