class OBSHandler extends Handler {
  /**
   * Create a new OBS handler.
   */
  constructor() {
    super('OBS', ['OnOBSSwitchScenes', 'OnOBSStreamStarted', 'OnOBSStreamStopped', 'OnOBSCustomMessage']);
    this.onSwitch = [];
    this.onSwitchTrigger = {};
    this.onStartTrigger = [];
    this.onStopTrigger = [];
    this.onCustom = [];
    this.onCustomTrigger = {};
  }

  /**
   * Initialize the connection to obs with the input settings.
   * @param {string} address obs websocket address
   * @param {string} password obs websocket password
   */
  init(address, password) {
    this.obs = connectOBSWebsocket(
      address, password, this.onSwitchScenes.bind(this), this.onStreamStart.bind(this),
      this.onStreamStop.bind(this), this.onCustomMessage.bind(this)
    );
  }

  /**
   * Register trigger from user input.
   * @param {string} trigger name to use for the handler
   * @param {array} triggerLine contents of trigger line
   * @param {number} id of the new trigger
   */
  addTriggerData(trigger, triggerLine, triggerId) {
    trigger = trigger.toLowerCase();
    switch (trigger) {
      case 'onobsswitchscenes':
        var scene = triggerLine.slice(1).join(' ');
        this.onSwitch.push(scene);
        this.onSwitchTrigger[scene] = triggerId;
        break;
      case 'onobsstreamstarted':
        this.onStartTrigger.push(triggerId);
        break;
      case 'onobsstreamstopped':
        this.onStopTrigger.push(triggerId);
        break;
      case 'onobscustommessage':
        var message = triggerLine.slice(1).join(' ');
        this.onCustom.push(message);
        this.onCustomTrigger[message] = triggerId;
      default:
        // do nothing
    }
    return;
  }

  /**
   * Handle switch scene messages from obs websocket.
   * @param {Object} data scene information
   */
  async onSwitchScenes(data) {
    var currentScene = await this.obs.getCurrentScene();
    if (currentScene.name === data.sceneName && this.onSwitch.indexOf(currentScene.name) !== -1) {
      controller.handleData(this.onSwitchTrigger[data.sceneName]);
    }
  }

  /**
   * Handle stream start messages from obs websocket.
   */
  onStreamStart() {
    if (this.onStartTrigger.length > 0) {
      this.onStartTrigger.forEach(trigger => {
        controller.handleData(trigger);
      })
    }
  }

  /**
   * Handle stream stop messages from obs websocket.
   */
  onStreamStop() {
    if (this.onStopTrigger.length > 0) {
      this.onStopTrigger.forEach(trigger => {
        controller.handleData(trigger);
      })
    }
  }

  /**
   * Handle custom messages from obs websocket.
   * @param {Object} broadcast obs custom message
   */
  onCustomMessage(broadcast) {
    if (broadcast.realm === 'kruiz-control' && this.onCustom.indexOf(broadcast.data.message) !== -1) {
      controller.handleData(this.onCustomTrigger[broadcast.data.message]);
    }
  }

  /**
   * Handle the input data (take an action).
   * @param {array} triggerData contents of trigger line
   */
  async handleData(triggerData) {
    var trigger = triggerData[1].toLowerCase();
    switch (trigger) {
      case 'scene':
        var scene = triggerData.slice(2).join(' ');
        await this.obs.setCurrentScene(scene);
        break;
      case 'source':
        var status = triggerData[triggerData.length - 1].toLowerCase() === 'on' ? true : false;
        var filterIndex = triggerData.indexOf('filter');
        if (filterIndex === -1) {
          filterIndex = triggerData.indexOf('Filter');
        }
        if (filterIndex === -1) {
          var source = triggerData.slice(2, triggerData.length - 1).join(' ');
          await this.obs.setSourceVisibility(source, status);
        }
        else {
          var source = triggerData.slice(2, filterIndex).join(' ');
          var filter = triggerData.slice(filterIndex + 1, triggerData.length - 1).join(' ');
          await this.obs.setFilterVisibility(source, filter, status);
        }
        break;
      case 'send':
        var message = triggerData.slice(2).join(' ');
        await this.obs.broadcastCustomMessage(message)
    }
    return;
  }
}

/**
 * Create a handler and read user settings
 */
function obsHandlerExport() {
  var obsHandler = new OBSHandler();
  readFile('settings/obs/address.txt', function(address) {
    readFile('settings/obs/password.txt', function(password) {
      obsHandler.init(address.trim(), password.trim());
    });
  });
}
obsHandlerExport();
