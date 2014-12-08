/* jshint undef: true, unused: true, browser:true, devel: true */
/* global define,  vec2 */

define(["code_128_reader", "ean_reader", "input_stream", "image_wrapper", "barcode_locator", "barcode_decoder", "frame_grabber", "html_utils", "config", "events", "camera_access"],
function(Code128Reader, EANReader, InputStream, ImageWrapper, BarcodeLocator, BarcodeDecoder, FrameGrabber, HtmlUtils, _config, Events, CameraAccess) {
    "use strict";
    
    var _inputStream,
        _framegrabber,
        _stopped,
        _canvasContainer = {
            ctx : {
                image : null,
                overlay : null
            },
            dom : {
                image : null,
                overlay : null
            }
        },
        _inputImageWrapper,
        _boxSize,
        _decoder,
        _locatorWorker,
        _initialized = false;

    function initialize(config) {
        _config = HtmlUtils.mergeObjects(_config, config);
        initInputStream();
        Events.subscribe("located", located);
    }
    
    function located(boxes) {
        var result;
        
        _canvasContainer.ctx.overlay.clearRect(0, 0, _inputImageWrapper.size.x, _inputImageWrapper.size.y);
        if (boxes) {
            result = _decoder.decodeFromBoundingBoxes(boxes);
            if (result && result.codeResult) {
                Events.publish("detected", result.codeResult.code);
            }
        }
    }

    function initConfig() {
        var vis = [{
            node : document.querySelector("div[data-controls]"),
            prop : _config.controls
        }, {
            node : _canvasContainer.dom.overlay,
            prop : _config.visual.show
        }];

        for (var i = 0; i < vis.length; i++) {
            if (vis[i].node) {
                if (vis[i].prop === true) {
                    vis[i].node.style.display = "block";
                } else {
                    vis[i].node.style.display = "none";
                }
            }
        }
    }

    function initInputStream() {
        var video;
        if (_config.inputStream.type == "VideoStream") {
            video = document.createElement("video");
            _inputStream = InputStream.createVideoStream(video);
        } else if (_config.inputStream.type == "ImageStream") {
            _inputStream = InputStream.createImageStream();
        } else if (_config.inputStream.type == "LiveStream") {
            video = document.createElement("video");
            var $viewport = document.querySelector("#interactive.viewport");
            if($viewport) {
                $viewport.appendChild(video);
            }
            _inputStream = InputStream.createLiveStream(video);
            CameraAccess.request(video, function(err) {
                if (!err) {
                    _inputStream.trigger("canrecord");
                } else {
                    console.log(err);
                }
            });
        }

        _inputStream.setAttribute("preload", "auto");
        _inputStream.setAttribute("autoplay", true);
        _inputStream.setInputStream(_config.inputStream);
        _inputStream.addEventListener("canrecord", canRecord);
    }

    function canRecord() {
        initBuffers();
        initCanvas();
        _decoder = BarcodeDecoder.create(_config.decoder, _inputImageWrapper);
        _framegrabber = FrameGrabber.create(_inputStream, _canvasContainer.dom.image);
        _framegrabber.attachData(_inputImageWrapper.data);

        initConfig();
        _inputStream.play();
        initWorkers();
    }

    function initCanvas() {
        var $viewport = document.querySelector("#interactive.viewport");
        _canvasContainer.dom.image = document.querySelector("canvas.imgBuffer");
        if (!_canvasContainer.dom.image) {
            _canvasContainer.dom.image = document.createElement("canvas");
            _canvasContainer.dom.image.className = "imgBuffer";
            if($viewport && _config.inputStream.type == "ImageStream") {
                $viewport.appendChild(_canvasContainer.dom.image);
            }
        }
        _canvasContainer.ctx.image = _canvasContainer.dom.image.getContext("2d");
        _canvasContainer.dom.image.width = _inputImageWrapper.size.x;
        _canvasContainer.dom.image.height = _inputImageWrapper.size.y;

        _canvasContainer.dom.overlay = document.querySelector("canvas.drawingBuffer");
        if (!_canvasContainer.dom.overlay) {
            _canvasContainer.dom.overlay = document.createElement("canvas");
            _canvasContainer.dom.overlay.className = "drawingBuffer";
            if($viewport) {
                $viewport.appendChild(_canvasContainer.dom.overlay);
            }
            var clearFix = document.createElement("br");
            clearFix.setAttribute("clear", "all");
            if($viewport) {
                $viewport.appendChild(clearFix);
            }
        }
        _canvasContainer.ctx.overlay = _canvasContainer.dom.overlay.getContext("2d");
        _canvasContainer.dom.overlay.width = _inputImageWrapper.size.x;
        _canvasContainer.dom.overlay.height = _inputImageWrapper.size.y;
    }

    function initBuffers() {
        _inputImageWrapper = new ImageWrapper({
            x : _inputStream.getWidth(),
            y : _inputStream.getHeight()
        });
        console.log(_inputStream.getWidth());
        console.log(_inputStream.getHeight());
        _boxSize = [
                vec2.create([20, _inputStream.getHeight() / 2 - 100]), 
                vec2.create([20, _inputStream.getHeight() / 2 + 100]), 
                vec2.create([_inputStream.getWidth() - 20, _inputStream.getHeight() / 2 + 100]), 
                vec2.create([_inputStream.getWidth() - 20, _inputStream.getHeight() / 2 - 100])
            ];
    }
    
    function initWorkers() {
        var data;
        
        _locatorWorker = new Worker('../src/worker_master_locator.js');
        data = _inputImageWrapper.data;
        _inputImageWrapper.data = null;
        _locatorWorker.postMessage({cmd: 'init', inputImageWrapper: _inputImageWrapper});
        _inputImageWrapper.data = data;
        _locatorWorker.onmessage = function(e) {
            if (e.data.event === 'initialized') {
                _initialized = true;
                if (_config.readyFunc) {
                    _config.readyFunc.apply();
                }
            } else if (e.data.event === 'located') {
                _inputImageWrapper.data = new Uint8Array(e.data.buffer);
                _framegrabber.attachData(_inputImageWrapper.data);
                Events.publish("located", e.data.result);
            }
        };
    }

    function getBoundingBoxes() {
        var boxes;

        if (_config.locate) {
            _locatorWorker.postMessage({cmd: 'locate', buffer: _inputImageWrapper.data.buffer}, [_inputImageWrapper.data.buffer]);
            _inputImageWrapper.data = null;
            _framegrabber.attachData(null);
        } else {
            boxes = [_boxSize];
            Events.publish("located", boxes);
        }
    }

    function update() {
        if (_framegrabber.grab()) {
            getBoundingBoxes();
        }
    }

    function start() {
        _stopped = false;
        ( function frame() {
            if (!_stopped) {
                if (_config.inputStream.type == "LiveStream") {
                    window.requestAnimFrame(frame);
                }
                if (_inputImageWrapper.data !== null) {
                    update();
                }
            }
        }());
    }

    return {
        init : function(config, callback) {
            initialize(config, callback);
        },
        start : function() {
            console.log("Start!");
            start();
        },
        stop : function() {
            _stopped = true;
        },
        onDetected : function(callback) {
            Events.subscribe("detected", callback);
        },
        isInitialized : function() {
            return _initialized;
        },
        setReaders: function(readers) {
            _decoder.setReaders(readers);
        },
        canvas : _canvasContainer,
        decodeSingle : function(config, resultCallback) {
            config.inputStream = {
                type : "ImageStream",
                src : config.src,
                sequence : false,
                size: 1280
            };
            config.readyFunc = function() {
                Events.subscribe("detected", function(result) {
                    _stopped = true;
                    resultCallback.call(null, result);
                }, true);
                start();
            };
            initialize(config);
        },
        Reader: {
          EANReader : EANReader,
          Code128Reader : Code128Reader
        }
    };
});
