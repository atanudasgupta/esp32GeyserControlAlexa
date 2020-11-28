var AWS = require('aws-sdk');

var constants = require('./constants');


AWS.config.region = constants.config.IOT_BROKER_REGION;

const DEFAULT_MIN=10;

//Initializing client for IoT

var iotData = new AWS.IotData({endpoint: constants.config.IOT_BROKER_ENDPOINT});

var sHandler = function () { };


//Prepare the parameters of the update call

sHandler.prototype.updateshadow = (val, duration=DEFAULT_MIN) => {
    return new Promise((resolve, reject) => {
      
        // use the shadow update value from alexa

        var payloadObj={ "state":
            { "desired":
            {"onOroff":val,
            "duration":duration
        }}};

        var paramsUpdate = {
            "thingName" : constants.config.IOT_THING_NAME,            
            "payload" : JSON.stringify(payloadObj)            
        };

        iotData.updateThingShadow(paramsUpdate, (err,data) => {
        if (err) {
                console.log("Unable to update =>", JSON.stringify(err))
                return reject("Unable to update !");
            }
            console.log("Shadow Updated, ", JSON.stringify(data));
            resolve(data);    

        });
         
         
    });
}

sHandler.prototype.enquireshadow =  () => {
    return new Promise((resolve, reject) => {
    
        var paramsUpdate = {
            "thingName" : constants.config.IOT_THING_NAME
                     
        };

         iotData.getThingShadow(paramsUpdate, (err,data) => {   
            if (err) {
                console.log("Unable to get shadow =>", JSON.stringify(err))
                return reject("Unable to fetch shadow !");
            }
            console.log("Got Shadow, ", JSON.stringify(data));
            resolve(data);    
        
        });

    });

}      

sHandler.prototype.onOroffshadow = () => {
    return new Promise((resolve, reject) => {
    
        var paramsUpdate = {
            "thingName" : constants.config.IOT_THING_NAME
                     
        };

        iotData.getThingShadow(paramsUpdate, (err,data) => {   
            if (err) {
                console.log("Unable to get shadow onOroff =>", JSON.stringify(err))
                return reject("Unable to fetch shadow onOroff !");
            }
            console.log("Got Shadow for onOroff, ", JSON.stringify(data));
            var objState = JSON.parse(data.payload);     
           
            var gstatus = objState.state.desired.onOroff;
            resolve(gstatus);    
        
        });
    });

}       

module.exports = new sHandler();