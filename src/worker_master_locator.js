/* jshint undef: true, unused: true, browser:true, devel: true */
/* global importScripts, self, Locator */

importScripts('../dist/locator.js');

var inputImageWrapper = null;

self.onmessage = function(e) {
    if (e.data.cmd === 'init') {
        inputImageWrapper = e.data.inputImageWrapper;
        init();
    } else if (e.data.cmd === 'locate') {
        locate(new Uint8Array(e.data.buffer));
    }
};

function init() {
    Locator.init({
        isMaster: true,
        nrOfSlices: 2,
        halfSample: false,
        patchSize: 16,
        showCanvas: false,
        showPatches: false,
        showFoundPatches: false,
        showSkeleton: false,
        showLabels: false,
        showPatchLabels: false,
        showRemainingPatchLabels: false,
        boxFromPatches: {
          showTransformed: false,
          showTransformedBox: false,
          showBB: false
        }
      }, {
        inputImageWrapper : inputImageWrapper
    }, function initialized() {
        self.postMessage({'event': 'initialized'});
    });
}

function locate(buffer) {
    var result,
        patchesFound;
    
    inputImageWrapper.data = buffer;
    Locator.binarize();
    patchesFound = Locator.locatePatches(function(patchesFound) {
        result = Locator.findBarcodeFromPatches(patchesFound);
        self.postMessage({'event': 'located', result: result, buffer : inputImageWrapper.data.buffer}, [inputImageWrapper.data.buffer]);
    });
}

