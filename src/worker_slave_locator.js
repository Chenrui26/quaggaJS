/* jshint undef: true, unused: true, browser:true, devel: true */
/* global importScripts, self, Locator */

importScripts('../dist/locator.js');

var binaryImageWrapper = null;

self.onmessage = function(e) {
    if (e.data.cmd === 'init') {
        binaryImageWrapper = e.data.inputImageWrapper;
        init();
    } else if (e.data.cmd === 'locate') {
        locate(new Uint8Array(e.data.buffer));
    }
};

function init() {
    binaryImageWrapper = Locator.init({
        isMaster: false,
        nrOfSlices: 1,
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
        inputImageWrapper : binaryImageWrapper
    }, function ready(){
        self.postMessage({'event': 'initialized'});
    });
    
}

function locate(buffer) {
    binaryImageWrapper.data = buffer;
    Locator.locatePatches(function(patchesFound) {
        self.postMessage({'event': 'located', result: patchesFound, buffer : binaryImageWrapper.data.buffer}, [binaryImageWrapper.data.buffer]);
    });
}

