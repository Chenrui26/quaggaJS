/* jshint undef: true, unused: true, browser:true, devel: true */
/* global importScripts, self, Locator */

importScripts('../dist/locator.js');

var inputImageWrapper = null;

self.onmessage = function(e) {
    console.log(e.data.cmd);
    if (e.data.cmd === 'init') {
        inputImageWrapper = e.data.inputImageWrapper;
        init();
    } else if (e.data.cmd === 'locate') {
        locate(new Uint8Array(e.data.buffer));
    }
};

function init() {
    Locator.init({
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
    });
    self.postMessage({'event': 'initialized'});
}

function locate(buffer) {
    var result;
    
    inputImageWrapper.data = buffer;
    result = Locator.locate();
    self.postMessage({'event': 'located', result: result, buffer : inputImageWrapper.data}, [inputImageWrapper.data.buffer]);
}

