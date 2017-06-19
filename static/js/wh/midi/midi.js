/**
 * Handles connection with soft- and hardware MIDI devices.
 *
 * @namespace WH
 */
window.WH = window.WH || {};

(function (ns) {

    function createMIDI(specs) {
        var that,
            controlsView = specs.controlsView,
            preferencesView = specs.preferencesView,
            midiNetwork = specs.midiNetwork,
            midiRemote = specs.midiRemote,
            midiSync = specs.midiSync,
            transport = specs.transport,
            midiAccess,
            inputs = [],
            outputs = [],
            selectedInput,
            selectedInputID,
            selectedOutput,
            selectedOutputID,
            isClockInEnabled,
            isNoteInEnabled,

            setup = function() {
                requestAccess(onAccessSuccess, onAccessFailure, false);
            },

            /**
             * Request system for access to MIDI ports.
             * @param {function} successCallback
             * @param {function} failureCallback
             * @param {boolean} sysex True if sysex data must be included.
             */
            requestAccess = function(successCallback, failureCallback, sysex) {
                if (navigator.requestMIDIAccess) {
                    navigator.requestMIDIAccess({
                        sysex: !!sysex
                    }).then(function(_midiAccess) {
                        if (!_midiAccess.inputs.size && !_midiAccess.outputs.size) {
                            failureCallback('No MIDI devices found on this system.');
                        } else {
                            successCallback(_midiAccess);
                        }
                    }, function() {
                        failureCallback('RequestMIDIAccess failed. Error message: ', errorMsg);
                    });
                } else {
                    failureCallback('Web MIDI API not available.');
                }
            },

            /**
             * MIDI access request failed.
             * @param {String} errorMessage
             */
            onAccessFailure = function(errorMessage) {
                console.log(errorMessage);
            },

            /**
             * MIDI access request succeeded.
             * @param {Object} midiAccessObj MidiAccess object.
             */
            onAccessSuccess = function(midiAccessObj) {
                console.log('MIDI enabled.');
                midiAccess = midiAccessObj;
                var inputs = midiAccess.inputs.values();
                var outputs = midiAccess.outputs.values();
                
                for (var port = inputs.next(); port && !port.done; port = inputs.next()) {
                    console.log('MIDI input port:', port.value.name + ' (' + port.value.manufacturer + ')');
                    createInput(port.value);
                }
                
                for (var port = outputs.next(); port && !port.done; port = outputs.next()) {
                    console.log('MIDI output port:', port.value.name + ' (' + port.value.manufacturer + ')');
                    createOutput(port.value);
                }

                // select an input and output if they're already known
                if (typeof selectedInputID === 'string' && selectedOutputID.length) {
                    selectInputByID(selectedInputID);
                }
                if (typeof selectedOutputID === 'string' && selectedOutputID.length) {
                    selectOutputByID(selectedOutputID);
                }
            },
            
            /**
             * Create a MIDI input model and view.
             * @param  {Object} midiPort MIDIInput object.
             */
            createInput = function(midiPort) {
                var input = ns.createMIDIPortInput({
                    midiPort: midiPort,
                    network: midiNetwork,
                    sync: midiSync,
                    remote: midiRemote
                });
                // create a view for this port in the preferences panel
                preferencesView.createMIDIPortView(true, input);
                // store port
                inputs.push(input);
            },
            
            /**
             * Create a MIDI output model and view.
             * @param  {Object} midiPort MIDIOutput object.
             */
            createOutput = function(midiPort) {
                var output = ns.createMIDIPortOutput({
                    midiPort: midiPort,
                    network: midiNetwork,
                    sync: midiSync,
                    remote: midiRemote
                });
                // create a view for this port in the preferences panel
                preferencesView.createMIDIPortView(false, output);
                // store port
                outputs.push(output);
            },

            /**
             * Select an input.
             * @param {String} id ID of the input.
             */
            selectInputByID = function(id) {
                selectedInputID = id;
                if (midiAccess) {
                    selectedInput = null;
                    var portMap = midiAccess.inputs.values();
                    for (port = portMap.next(); port && !port.done; port = portMap.next()) {
                        if (port.value.id === id) {
                            selectedInput = port.value;
                            preferencesView.setSelectedMidiPort(id, true);
                            midiNetwork.connectAllEPGToInput(id, selectedInputID);
                            selectedInputID = id;
                        }
                    }
                }
            },

            /**
             * Select an output.
             * @param {String} id ID of the output.
             */
            selectOutputByID = function(id) {
                selectedOutputID = id;
                if (midiAccess) {
                    selectedOutput = null;
                    var portMap = midiAccess.outputs.values();
                    for (port = portMap.next(); port && !port.done; port = portMap.next()) {
                        if (port.value.id === id) {
                            selectedOutput = port.value;
                            preferencesView.setSelectedMidiPort(id, false);
                            midiNetwork.connectAllEPGToOutput(id, selectedOutputID);
                            selectedOutputID = id;
                        }
                    }
                }
            },

            /**
             * Toggle between internal clock and external MIDI clock sync.
             * @param {Boolean} isEnabled Sync to MIDI clock when true.
             */
            setClockInEnabled = function(isEnabled) {
                isClockInEnabled = isEnabled;
                controlsView.setControlsEnabled(!isClockInEnabled);
                // only enable if there is a MIDI input port
                if ((isClockInEnabled && selectedInput) || !isClockInEnabled) {
                    transport.setExternalClockEnabled(isClockInEnabled, selectedInput);
                }
            },

            /**
             * Restore MIDI port object settings from data object.
             * @param {Object} data Preferences data object.
             */
            setData = function(data) {
                // selectInputByID(data.midiin);
                // selectOutputByID(data.midiout);
                // setClockInEnabled(data.clockin);
                
                if (data.inputs) {
                    let inputData;
                    for (let i = 0, n = data.inputs.length; i < n; i++) {
                        inputData = data.inputs[i];
                        // find the input port by MIDIInput ID
                        for (let j = 0, nn = inputs.length; j < nn; j++) {
                            if (inputData.midiPortID == inputs[j].getID()) {
                                inputs[j].setData(inputData);
                            }
                        }
                    }
                }
                
                if (data.outputs) {
                    let outputData;
                    for (let i = 0, n = data.outputs.length; i < n; i++) {
                        outputData = data.outputs[i];
                        // find the output port by MIDIOutput ID
                        for (let j = 0, nn = outputs.length; j < nn; j++) {
                            if (outputData.midiPortID == outputs[j].getID()) {
                                outputs[j].setData(outputData);
                            }
                        }
                    }
                }
            },

            /**
             * Write MIDI port object settings to data object.
             * @return {Object} MIDI port object data.
             */
            getData = function() {
                // return {
                //     'midiin': selectedInput ? selectedInput.id : '',
                //     'midiout': selectedOutput ? selectedOutput.id : '',
                //     'clockin': isClockInEnabled
                // };
                
                const data = {
                    inputs: [],
                    outputs: []
                };
                
                for (let i = 0, n = inputs.length; i < n; i++) {
                    data.inputs.push(inputs[i].getData());
                }
                
                for (let i = 0, n = outputs.length; i < n; i++) {
                    data.outputs.push(outputs[i].getData());
                }
                
                return data;
            };

        that = specs.that;

        that.setup = setup;
        that.selectInputByID = selectInputByID;
        that.selectOutputByID = selectOutputByID;
        that.setClockInEnabled = setClockInEnabled;
        that.setData = setData;
        that.getData = getData;
        return that;
    }

    ns.createMIDI = createMIDI;

})(WH);
