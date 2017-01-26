import { OHIF } from 'meteor/ohif:core';
import { MeasurementReport } from 'meteor/ohif:measurements/client/reports/measurement';

OHIF.measurements.exportPdf = (measurementApi, timepointApi) => {
    const currentTimepoint = timepointApi.current();
    const { timepointId } = currentTimepoint;
    const study = ViewerStudies.findOne({
        studyInstanceUid: currentTimepoint.studyInstanceUids[0]
    });
    const report = new MeasurementReport({
        header: {
            trial: 'RECIST 1.1',
            patientName: formatPN(study.patientName),
            mrn: study.patientId,
            timepoint: timepointApi.name(currentTimepoint)
        }
    });

    const $element = $('<div></div>').css({
        height: 800,
        left: 0,
        position: 'fixed',
        top: 0,
        visibility: 'hidden',
        width: 800,
        'z-index': -1
    });
    const element = $element[0];
    $element.appendTo(document.body);
    cornerstone.enable(element, { renderer: 'webgl' });
    const enabledElement = cornerstone.getEnabledElement(element);
    enabledElement.toolStateManager = cornerstoneTools.newImageIdSpecificToolStateManager();

    const targets = measurementApi.fetch('targets', { timepointId });
    const nonTargets = measurementApi.fetch('nonTargets', { timepointId });
    const measurements = targets.concat(nonTargets);

    const iterator = measurements[Symbol.iterator]();
    const printMeasurements = callback => {
        const current = iterator.next();
        if (current.done) {
            callback();
            return;
        }

        const measurement = current.value;
        cornerstone.loadImage(measurement.imageId).then(image => {
            cornerstone.displayImage(element, image);
            cornerstoneTools.addToolState(element, measurement.toolType, measurement);
            cornerstoneTools[measurement.toolType].enable(element);

            let info = measurement.response;
            if (!info) {
                info = measurement.longestDiameter;
                if (measurement.shortestDiameter) {
                    info += ` × ${measurement.shortestDiameter}`;
                }

                info += ' mm';
            }

            report.printMeasurement({
                type: measurement.toolType,
                number: measurement.measurementNumber,
                location: measurement.location || '',
                info,
                image: enabledElement.canvas.toDataURL()
            });
            cornerstoneTools.clearToolState(element, measurement.toolType);

            printMeasurements(callback);
        });
    };

    printMeasurements(() => {
        $element.remove();
        report.save('measurements.pdf');
    });
};
