'use strict';

var kFontStep = 4;
var kMinFontSize = 12;
// Frequencies comming from http://en.wikipedia.org/wiki/Telephone_keypad
var gTonesFrequencies = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
};


// Bug 690056 implement a visibility API, and it's likely that
// we want this event to be fire when an app come back to life
// or is minimized (it does not now).
window.addEventListener('message', function visibleApp(evt) {
  var data = evt.data;
  if (data.message == 'visibilitychange') {
    visibilityChanged(data.url, evt);
  } else if (data == 'connected') {
    CallHandler.connected();
  } else if (data == 'disconnected') {
    CallHandler.disconnected();
  }
});

function visibilityChanged(url, evt) {
  var data = evt.data;
  var params = (function makeURL() {
    var a = document.createElement('a');
    a.href = url;

    var rv = {};
    var params = a.search.substring(1, a.search.length).split('&');
    for (var i = 0; i < params.length; i++) {
      var data = params[i].split('=');
      rv[data[0]] = data[1];
    }
    return rv;
  })();

  if (!data.hidden) {
    Recents.startUpdatingDates();

    var choice = params['choice'];
    var contacts = document.getElementById('contacts-label');
    if (choice == 'contact' || contacts.hasAttribute('data-active')) {
      Contacts.load();
      choiceChanged(contacts);
    }
  } else {
    Recents.stopUpdatingDates();
  }
}

function choiceChanged(target) {
  var choice = target.dataset.choice;
  if (!choice)
    return;

  if (choice == 'contacts') {
    Contacts.load();
  }

  var view = document.getElementById(choice + '-view');
  if (!view)
    return;

  var tabs = document.getElementById('tabs').querySelector('fieldset');
  var tabsCount = tabs.childElementCount;
  for (var i = 0; i < tabsCount; i++) {
    var tab = tabs.children[i];
    delete tab.dataset.active;

    var tabView = document.getElementById(tab.dataset.choice + '-view');
    if (tabView)
      tabView.hidden = true;
  }

  target.dataset.active = true;
  view.hidden = false;
}


/*
 * Class which manage the different sounds in "keypad" while dialing
 */

var TonePlayer = {
  _sampleRate: 4000,

  init: function tp_init() {
   this._audio = new Audio();
   this._audio.mozSetup(2, this._sampleRate);
  },

  generateFrames: function tp_generateFrames(soundData, freqRow, freqCol) {
    var currentSoundSample = 0;
    var kr = 2 * Math.PI * freqRow / this._sampleRate;
    var kc = 2 * Math.PI * freqCol / this._sampleRate;
    for (var i = 0; i < soundData.length; i += 2) {
      var smoother = 0.5 + (Math.sin((i * Math.PI) / soundData.length)) / 2;

      soundData[i] = Math.sin(kr * currentSoundSample) * smoother;
      soundData[i + 1] = Math.sin(kc * currentSoundSample) * smoother;

      currentSoundSample++;
    }
  },

  play: function tp_play(frequencies) {
    var soundDataSize = this._sampleRate / 4;
    var soundData = new Float32Array(soundDataSize);
    this.generateFrames(soundData, frequencies[0], frequencies[1]);
    this._audio.mozWriteAudio(soundData);
  }
};

/*
 * Class which manage the different sounds in "keypad" while dialing
 */

var KeyHandler = {
 
  init: function kh_init() {

    //TODO Check when this method is called, every time you launch the app?
    
    //Clean previous values in phone number
    document.getElementById('phone-number').value = '';
    document.getElementById('phone-number-view').innerHTML = '';
    
    // Add listeners
    document.getElementById('kb-keypad').addEventListener('mousedown',this.keyHandler,true);
    document.getElementById('kb-keypad').addEventListener('mouseup',this.keyHandler,false);
    document.getElementById('kb-callbar-add-contact').addEventListener('mouseup',this.addContact,false);
    document.getElementById('kb-callbar-call-action').addEventListener('mouseup',this.makeCall,false);
    document.getElementById('kb-delete').addEventListener('mousedown',this.deleteDigit,false);
    document.getElementById('kb-delete').addEventListener('mouseup',this.deleteDigit,false);

    //Start Player of sounds in dialer
    TonePlayer.init();
  },
  /*
   * Method which delete a digit/all digits from screen. It depends on "Hold action"
   * Hold functionality is based on two var: hold_timer,hold_active.
   */
  deleteDigit:function hk_deleteDigit(event){
    //We stop bubbling propagation 
    event.stopPropagation();

    //Depending of the event type 
    if(event.type=='mousedown'){
      //Start holding event management
      KeyHandler.hold_timer=setTimeout(function(){
        // After .400s we consider that is a "Hold action"
        KeyHandler.hold_active=true;
      },400);
    }else if(event.type=='mouseup'){
      //In is a "Hold action" end
      if(KeyHandler.hold_active){
        //We delete all digits
        document.getElementById('phone-number').value='';
        document.getElementById('phone-number-view').innerHTML='';
      }else{
        //Delete last digit
        var previous_value=document.getElementById('phone-number').value;
        var current_value=previous_value.slice(0, -1);
        document.getElementById('phone-number').value=current_value;
        document.getElementById('phone-number-view').innerHTML=current_value;
      }
      
      //We set to default var involved in "Hold event" management
      clearTimeout(KeyHandler.hold_timer);
      KeyHandler.hold_active=false;
    }
  },
  /*
   * Method that retrieves phone number and makes a phone call
   */
  makeCall: function hk_makeCall(event){
    //Stop bubbling propagation 
    event.stopPropagation();

    //Retrieve phone number from input in DOM
    var tel_number=document.getElementById('phone-number').value;

    //If is not empty --> Make call
    if (tel_number != '') {
        CallHandler.call(tel_number);
    }
  },
  /*
   * Method that add phone number to contact list
   */
  addContact: function hk_addContact(event){
    
    //TODO Create the request to the contacts app

  },
  /*
   * Method which handle keypad actions
   */
  keyHandler:function keyHandler(event){
    //Stop bubbling propagation 
    event.stopPropagation();

    //Depending on event type
    if(event.type=='mousedown'){
      //If is a dial action in keypad
      if(event.target.getAttribute('data-type')=='dial'){
        //Retrieve key pressed
        var key=event.target.getAttribute('data-value');

        //Play key sound
        TonePlayer.play(gTonesFrequencies[key]);

        //Manage "Hold action" in "0" key
        if(key=='0'){
          KeyHandler.hold_timer=setTimeout(function(){
            KeyHandler.hold_active=true;
          },400);
        }
      }
    }else if(event.type=='mouseup'){
      //Retrieve type of button which produces event
      var data_type=event.target.getAttribute('data-type');
      if(data_type=='dial'){
        //If is a dial action in keypad retrieve key value
        var key=event.target.getAttribute('data-value');
        
        //If key is "0", has a "Hold action"?
        if(key=='0'){
          if(KeyHandler.hold_active){
            document.getElementById('phone-number').value+='+';
            document.getElementById('phone-number-view').innerHTML+='+';
          }else{
            document.getElementById('phone-number').value+=key;
            document.getElementById('phone-number-view').innerHTML+=key;
          }
        }else{
          document.getElementById('phone-number').value+=key;
          document.getElementById('phone-number-view').innerHTML+=key;
        }

        //We set to default var involved in "Hold event" management
        clearTimeout(KeyHandler.hold_timer);
        KeyHandler.hold_active=false;

        
        // Sending the DTMF tone
        var telephony = navigator.mozTelephony;
        if (telephony) {
          telephony.startTone(key);
          window.setTimeout(function ch_stopTone() {
            telephony.stopTone();
          }, 100);
        }
      }
    }
  },
  handleEvent: function kh_handleEvent(event){
    //TODO Use it if is necessary to control more events
    
  }
 
};

var CallHandler = {
  currentCall: null,
  _onCall: false,
  _screenLock: null,

  setupTelephony: function ch_setupTelephony() {
    if (this._telephonySetup)
      return;

    this._telephonySetup = true;

    var telephony = navigator.mozTelephony;
    if (telephony.calls.length > 0) {
      var call = telephony.calls[0];
      CallHandler.incoming(call);
    }

    telephony.oncallschanged = function cc(evt) {
      telephony.calls.forEach(function(call) {
        if (call.state == 'incoming')
          CallHandler.incoming(call);
      });
    };
  },

  // callbacks
  call: function ch_call(number) {
    this.callScreen.classList.remove('incoming');
    this.callScreen.classList.remove('in-call');
    this.callScreen.classList.add('calling');
    this.numberView.innerHTML = number;
    this.statusView.innerHTML = 'Calling...';

    this.lookupContact(number);

    var sanitizedNumber = number.replace(/-/g, '');
    var call = window.navigator.mozTelephony.dial(sanitizedNumber);
    call.addEventListener('statechange', this);
    this.currentCall = call;

    this.recentsEntry = {date: Date.now(), type: 'outgoing', number: number};

    this.toggleCallScreen();
  },

  incoming: function ch_incoming(call) {
    this.callScreen.classList.remove('calling');
    this.callScreen.classList.remove('in-call');
    this.callScreen.classList.add('incoming');

    this.currentCall = call;
    call.addEventListener('statechange', this);

    this.recentsEntry = {
      date: Date.now(),
      type: 'incoming',
      number: call.number
    };

    this.numberView.innerHTML = call.number || 'Anonymous';
    this.statusView.innerHTML = 'Call from...';

    if (call.number)
      this.lookupContact(call.number);

    this.toggleCallScreen();
  },

  connected: function ch_connected() {
    var callDirectionChar = "";
    if(this.callScreen.classList.contains('incoming')) {
      this.callScreen.classList.remove('incoming');
      callDirectionChar = "&#8618";
    } else 
    if(this.callScreen.classList.contains('calling')) {
      this.callScreen.classList.remove('calling');
      callDirectionChar = "&#8617";
    }
    this.callScreen.classList.add("in-call");
    // hardening against rapid ending
    if (!this._onCall)
      return;

    this.callDurationView.innerHTML = callDirectionChar + ' ' + '00:00';

    this.recentsEntry.type += '-connected';

    this._ticker = setInterval(function ch_updateTimer(self, startTime) {
      var elapsed = new Date(Date.now() - startTime);
      self.callDurationView.innerHTML = callDirectionChar + ' ' + elapsed.toLocaleFormat('%M:%S');
    }, 1000, this, Date.now());
  },

  answer: function ch_answer() {
    this.currentCall.answer();
  },

  end: function ch_end() {
    if (this.recentsEntry &&
       (this.recentsEntry.type.indexOf('-connected') == -1)) {
      this.recentsEntry.type += '-refused';
    }

    if (this.currentCall) {
      this.currentCall.hangUp();
    }

    // We're not waiting for a disconnected statechange
    // If the user touch the 'end' button we wants to get
    // out of the call-screen right away.
    this.disconnected();
  },

  disconnected: function ch_disconnected() {
    if (this.currentCall) {
      this.currentCall.removeEventListener('statechange', this);
      this.currentCall = null;
    }

    if (this.muteButton.classList.contains('mute'))
      this.toggleMute();
    if (this.speakerButton.classList.contains('speak'))
      this.toggleSpeaker();
    if (this.keypadButton.classList.contains('displayed'))
      this.toggleKeypad();

    clearInterval(this._ticker);

    this.toggleCallScreen();

    if (this.recentsEntry) {
      Recents.add(this.recentsEntry);

      if ((this.recentsEntry.type.indexOf('outgoing') == -1) &&
          (this.recentsEntry.type.indexOf('-refused') == -1) &&
          (this.recentsEntry.type.indexOf('-connected') == -1)) {

        var mozNotif = navigator.mozNotification;
        if (mozNotif) {
          var notification = mozNotif.createNotification(
            'Missed call', 'From ' + this.recentsEntry.number
          );

          notification.onclick = function ch_notificationClick() {
            var recents = document.getElementById('recents-label');
            choiceChanged(recents);
            Recents.showLast();

            // Asking to launch itself
            navigator.mozApps.getSelf().onsuccess = function(e) {
              var app = e.target.result;
              app.launch();
            };
          };

          notification.show();
        }
      }
      this.recentsEntry = null;
    }
  },

  handleEvent: function fm_handleEvent(evt) {
    switch (evt.call.state) {
      case 'connected':
        this.connected();
        break;
      case 'disconnected':
        this.disconnected();
        break;
      default:
        break;
    }
  },

  // properties / methods
  get callScreen() {
    delete this.callScreen;
    return this.callScreen = document.getElementById('call-screen');
  },
  get numberView() {
    delete this.numberView;
    return this.numberView = document.getElementById('call-number-view');
  },
  get statusView() {
    delete this.statusView;
    return this.statusView = document.getElementById('call-status-view');
  },
  get callDurationView() {
    delete this.statusView;
    return this.statusView = document.getElementById('call-duration-view');
  },
  get actionsView() {
    delete this.actionsView;
    return this.actionsView = document.getElementById('call-actions-container');
  },
  get muteButton() {
    delete this.muteButton;
    return this.muteButton = document.getElementById('mute-button');
  },
  get speakerButton() {
    delete this.speakerButton;
    return this.speakerButton = document.getElementById('speaker-button');
  },
  get keypadButton() {
    delete this.keypadButton;
    return this.keypadButton = document.getElementById('keypad-button');
  },
  get keypadView() {
    delete this.keypadView;
    // return this.keypadView = document.getElementById('mainKeyset');
    return this.keypadView = document.getElementById('kb-keypad');

  },

  execute: function ch_execute(action) {
    if (!this[action]) {
      this.end();
      return;
    }

    this[action]();
  },

  toggleCallScreen: function ch_toggleScreen() {
    var callScreen = document.getElementById('call-screen');
    callScreen.classList.remove('animate');

    var onCall = this._onCall;
    callScreen.classList.toggle('prerender');

    // hardening against the unavailability of MozAfterPaint
    var finished = false;

    var finishTransition = function ch_finishTransition() {
      if (finished)
        return;

      if (securityTimeout) {
        clearTimeout(securityTimeout);
        securityTimeout = null;
      }

      finished = true;

      window.setTimeout(function cs_transitionNextLoop() {
        callScreen.classList.add('animate');
        callScreen.classList.toggle('oncall');
        callScreen.classList.toggle('prerender');
      });
    };

    window.addEventListener('MozAfterPaint', function ch_finishAfterPaint() {
      window.removeEventListener('MozAfterPaint', ch_finishAfterPaint);
      finishTransition();
    });
    var securityTimeout = window.setTimeout(finishTransition, 100);

    this._onCall = !this._onCall;

    // Assume we always either onCall or not, and always onCall before
    // not onCall.
    if (this._onCall) {
      this._screenLock = navigator.requestWakeLock('screen');
      ProximityHandler.enable();
    } else {
      this._screenLock.unlock();
      this._screenLock = null;
      ProximityHandler.disable();
    }
  },

  toggleMute: function ch_toggleMute() {
    this.muteButton.classList.toggle('mute');
    navigator.mozTelephony.muted = !navigator.mozTelephony.muted;
  },

  toggleKeypad: function ch_toggleKeypad() {
    // Do nothing.
    // this.keypadButton.classList.toggle('displayed');
    // this.keypadView.classList.toggle('overlay');
  },

  toggleSpeaker: function ch_toggleSpeaker() {
    this.speakerButton.classList.toggle('speak');
    navigator.mozTelephony.speakerEnabled =
      !navigator.mozTelephony.speakerEnabled;
  },

  lookupContact: function ch_lookupContact(number) {
    Contacts.findByNumber(number, (function(contact) {
      this.numberView.innerHTML = contact.name;
    }).bind(this));
  }
};

window.addEventListener('localized', function startup(evt) {
  window.removeEventListener('localized', startup);

  KeyHandler.init();
  CallHandler.setupTelephony();

  // Set the 'lang' and 'dir' attributes to <html> when the page is translated
  var html = document.querySelector('html');
  var lang = document.mozL10n.language;
  html.lang = lang.code;
  html.dir = lang.direction;

  // <body> children are hidden until the UI is translated
  document.body.classList.remove('hidden');
});
