const fs = require('fs');
const path = require('path');
const express = require('express');



const calculateAvailability = (statusData) => {
    let runningTime = 0;
    let idleTime = 0;
    let downTime = 0;

    statusData.forEach(entry => {
        const startTime = new Date(entry.Start_Time);
        const endTime = new Date(entry.End_Time);

        // Skip invalid date entries
        if (isNaN(startTime) || isNaN(endTime)) return;

        const duration = (endTime - startTime) / 1000; // in seconds

        if (entry.Status === "RUNNING") {
            runningTime += duration;
        } else if (entry.Status === "IDLE") {
            idleTime += duration;
        } else if (entry.Status === "DOWN") {
            downTime += duration;
        }
    });

    const totalTime = runningTime + idleTime + downTime;
    return totalTime ? (runningTime + idleTime) / totalTime :0 ; // Availability
};

const calculatePerformance = (productionData) => {
    const plannedDuration = productionData.reduce((sum, entry) => sum + entry.planned_duration_in_second, 0);
    const plannedQuantity = productionData.reduce((sum, entry) => sum + entry.planned_quantity, 0);
    const actualDuration = productionData.reduce((sum, entry) => {
        const start = new Date(entry.start_production);
        const end = new Date(entry.finish_production);
        return sum + (end - start) / 1000; // in seconds
    }, 0);
    const actualQuantity = productionData.reduce((sum, entry) => sum + entry.actual_quantity, 0);

    const idealCycleTime = plannedDuration / plannedQuantity;
    const actualCycleTime = actualDuration / actualQuantity;

    let performance = idealCycleTime / actualCycleTime;
    if (performance > 1) performance = 1;
    return performance;
};

const calculateQuality = (productionData) => {
    const actualQuantity = productionData.reduce((sum, entry) => sum + entry.actual_quantity, 0);
    const defectQuantity = productionData.reduce((sum, entry) => sum + entry.defect_quantity, 0);

    const goodQuantity = actualQuantity - defectQuantity;
    const quality = actualQuantity ? goodQuantity / actualQuantity : 0;
    return quality;
};

const calculateOEE = (statusData, productionData) => {
    const  availability  = calculateAvailability(statusData);
    const performance = calculatePerformance(productionData);
    const quality = calculateQuality(productionData);

    const oee = availability * performance * quality;
    return { availability, performance, quality, oee };
};

module.exports = {
    calculateAvailability,
    calculatePerformance,
    calculateQuality,
    calculateOEE,
};