import * as firebase from 'firebase';
import * as Methods from "./AllOtherCode";
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from "react-native";
import React from "react";
import NetInfo from "@react-native-community/netinfo";


Methods.configureFirebase()

let dev = false

const storageRef = firebase.storage().ref()
let settings = {};
let images = {};
let oldWebsiteData;
let recentWebsiteData;
let downloadImages = false;
let downloadSettings = false;

let errorThrown = false;
let promiseResponse;
let parsedResponse;



export async function checkUpdate() {
    NetInfo.fetch()
        .then(connectionState =>
            {
                if(!connectionState.isConnected){
                    handleError("Network Not connected", "Network-not-available")
                }
            }
        )


    /*                                                                                                                                          .                      .
      Get the previously saved settings/images numbers
    */
    promiseResponse = await AsyncStorage.getItem('websiteData');
    parsedResponse = await JSON.parse(promiseResponse);
    if (parsedResponse) {
        oldWebsiteData = parsedResponse;
    }

    if(dev){
        console.log("downloading both because of dev")
        downloadImages = true
        downloadSettings = true
    }



    /*                                                                                                                                          .                      .
      Get current settings/images numbers and verification words from the viwards website
    */
    let url = "website link with JSON data stored";
    let options = {
        headers: {
            dataType: 'json',
            'Authorization': "confidential data"
        }
    };

    promiseResponse = await fetch(url, options)
        .catch(err => handleError(err, 1));
    recentWebsiteData = await promiseResponse.json();
    await AsyncStorage.setItem("websiteData", JSON.stringify(recentWebsiteData))
        .catch(err => handleError(err, 2));


    /*.                   .
    if there was no data from the server already stored, download both the images and
    settings. If there was data from the website already stored, check it against the new
    data to see if the version numbers for the images and settings match, and download accordingly */
    if(oldWebsiteData != null) {
        if (oldWebsiteData["versionNumbers"]["images"] !== recentWebsiteData["versionNumbers"]["images"]) {
            console.log("downloading images because numbers don't match");
            downloadImages = true;
        } else {
            console.log("Images numbers match");
        }
        if (oldWebsiteData["versionNumbers"]["settings"] !== recentWebsiteData["versionNumbers"]["settings"]) {
            downloadSettings = true
            console.log("downloading settings because numbers don't match");
        } else {
            console.log("settings numbers match");
        }
    }else{
        console.log("downloading both because there was no old server data.");
        downloadSettings = true;
        downloadImages = true;
    }


    promiseResponse = await AsyncStorage.getItem("settings");
    parsedResponse = await JSON.parse(promiseResponse);
    if (parsedResponse) {
        settings = parsedResponse
    }else{
        /*.              .
        * If there's no settings data, download both even if the versions
        * from the website match to be safe.  */
        console.log("downloading both because there were no settings saved to the phone.")
        downloadSettings = true
        downloadImages = true
    }


    promiseResponse = await AsyncStorage.getItem("images");
    parsedResponse = await JSON.parse(promiseResponse);
    if (parsedResponse) {
        images = parsedResponse
    }else{
        /*.              .
        * If there's no data stored in images, download both even if the versions
        * from the website match to be safe.  */
        console.log("downloading both because there were no images saved to the phone.")
        downloadSettings = true
        downloadImages = true
    }



    /*                                                                                                                                   .                  .
    Download both settings and images if there was an error last time.  */
    promiseResponse = await AsyncStorage.getItem("errorThrown");
    if(promiseResponse){
        parsedResponse = await JSON.parse(promiseResponse);
        if(parsedResponse === "true"){
            downloadSettings = true
            downloadImages = true
            console.log("downloading images and settings because there was an error last time.")
        }
    }


    if(downloadSettings){
        console.log("Now downloading settings")
    options =  {
        headers: {
            dataType: 'json',
        }
    };
    promiseResponse = await storageRef.child("settings.json").getDownloadURL()
        .catch(err => handleError(err, 3));
    promiseResponse = await fetch(promiseResponse, options)
        .catch(err => handleError(err, 4));
    parsedResponse = await promiseResponse.json();
    settings = parsedResponse
    }else{
        console.log("not downloading settings")
    }


    /***This needs to be the last if statement before finalSettings() because it sets asyncstorage and global.stores.
     ***/
    if(downloadImages){
        images = {}
        for(const key in settings){
            if(key.slice(0, 5) === "store") {
                const storeNumber = key
                const filename = await storeNumber.replace(" ", '_').toLowerCase() + ".jpg"

                promiseResponse = await storageRef.child("images/"+filename).getDownloadURL()
                    .catch(err => handleError(err,5));
                promiseResponse = await fetch(promiseResponse)
                    .catch(err => handleError(err,6));
                parsedResponse = await promiseResponse.blob();
                const reader = new FileReader();
                /* 
                convert blob image to base64 and add to JSON object 'images'.*/
                await reader.readAsDataURL(parsedResponse);
                reader.onloadend = async function () {
                    images[key] = reader.result

                }
            }
        }
    }else{
        console.log("not downloading images")
    }



    await finalSettings()
}


function handleError(err, errorCode){
    /*
    If there's an error thrown, create an inescapable window and force download of images and settings on next load.*/
    console.log("Error on line")
    console.log(errorCode)
    Alert.alert("Error Getting Data", "Please restart your app or try again later.\nError code "
         + errorCode,[null],
        {cancelable: false}
    )
    errorThrown = true
    AsyncStorage.setItem("errorThrown", JSON.stringify("true"));
}


async function finalSettings(){
    /* Making a function for readability even if it's not re-used is a personal preference. If your company doesn't
    allow that, I have no problem using functions only for re-use.*/

    for(const key in settings){
        /*                                                                                                                              .                                .
        Set the verificationWords to what's in the server data (from cPanel) before saving. */
        if(key !== "otherData") {
            settings[key]["misc"]["verificationWords"] = Methods.getValuesFromEachKey(recentWebsiteData["verificationWords"][key])
        }
    }

    await AsyncStorage.setItem("settings", JSON.stringify(settings))
        .catch(err => handleError(err, 15));

    await AsyncStorage.setItem("images", JSON.stringify(images))
        .catch(err => handleError(err, 16));

    global.storeSettingsVariable = settings;


    for(const key in images){
        if(key in global.storeSettingsVariable) {
            global.storeSettingsVariable[key]["image"] = images[key]
        }
    }

    console.log("final settings done");
    if(!errorThrown){
        AsyncStorage.setItem("errorThrown", JSON.stringify("false"))
    }
}

