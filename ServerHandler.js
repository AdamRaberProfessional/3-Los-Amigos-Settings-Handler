import * as firebase from 'firebase';
import * as Methods from "./AllOtherCode";
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from "react";
import NetInfo from "@react-native-community/netinfo";


Methods.configureFirebase()

let dev = false

const storageRef = firebase.storage().ref()
let settings = {};
let images = {};
let oldServerData;
let recentServerData;
let downloadImages = false;
let downloadSettings = false;

let errorThrown = false;
let promiseResponse;
let responseData;



export async function checkUpdate(_this) {
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
    promiseResponse = await AsyncStorage.getItem('serverData');
    responseData = await JSON.parse(promiseResponse);
    if (responseData) {
        oldServerData = responseData;
    }

    if(dev){
        console.log("downloading both because of dev")
        downloadImages = true
        downloadSettings = true
    }


    resetResponses()

    /*                                                                                                                                          .                      .
      Get the current settings/images numbers and the words from the viwards website
    */
    let url = 'https://{sensitive data}.com';
    let options = {
        headers: {
            dataType: 'json',
            'Authorization': 'Bearer {sensitive data}'
        }
    };

    promiseResponse = await fetch(url, options)
        .catch(err => handleError(err, 3));
    recentServerData = await promiseResponse.json();
    await AsyncStorage.setItem("serverData", JSON.stringify(recentServerData))
        .catch(err => handleError(err, 4));


    /*.                   .
    if there was no data from the server already stored, we need to download both the images and
    settings. If there was data from the server already stored, we need to check it
    against the new
    data to see if the version numbers for the images and settings match. If they don't match for
    either the settings or the images, that means we need to download either the settings or
    images (or both).*/
    if(oldServerData != null) {
        if (oldServerData["versionNumbers"]["images"] !== recentServerData["versionNumbers"]["images"]) {
            console.log("downloading images because numbers don't match");
            downloadImages = true;
        } else {
            console.log("Images numbers match");
        }
        if (oldServerData["versionNumbers"]["settings"] !== recentServerData["versionNumbers"]["settings"]) {
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
    responseData = await JSON.parse(promiseResponse);
    if (responseData) {
        settings = responseData
    }else{
        /*.              .
        * If there's no data stored in settingsAndImages, we need to download both, even if the versions
        * from our web server match.  */
        console.log("downloading both because there were no settings saved to the phone.")
        downloadSettings = true
        downloadImages = true
    }

    resetResponses()

    promiseResponse = await AsyncStorage.getItem("images");
    responseData = await JSON.parse(promiseResponse);
    if (responseData) {
        images = responseData
    }else{
        /*.              .
        * If there's no data stored in settingsAndImages, we need to download both, even if the versions
        * from our web server match.  */
        console.log("downloading both because there were no images saved to the phone.")
        downloadSettings = true
        downloadImages = true
    }

    resetResponses()



    /*                                                                                                                                   .                  .
    Download both settings and images if there was an error last time.  */
    promiseResponse = await AsyncStorage.getItem("errorThrown");
    if(promiseResponse){
        responseData = await JSON.parse(promiseResponse);
        if(responseData === "true"){
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
            .catch(err => handleError(err, 6));
        promiseResponse = await fetch(promiseResponse, options)
            .catch(err => handleError(err, 7));
        responseData = await promiseResponse.json();
        settings = responseData
    }else{
        console.log("not downloading settings")
    }
    resetResponses()


    /***This needs to be the last if statement before the end because it sets the storage and global.stores.
     If it's not last, and a setting is set***/
    if(downloadImages){
        images = {}
        for(const key in settings){
            if(key !== "otherData") {
                /* .            .
                otherData should be the only other keys in the JSON object except for the stores. */
                const filename = await key.replace(" ", '_').toLowerCase() + ".jpg"

                promiseResponse = await storageRef.child("images/"+filename).getDownloadURL()
                    .catch(err => handleError(err,9));
                promiseResponse = await fetch(promiseResponse)
                    .catch(err => handleError(err,10));
                responseData = await promiseResponse.blob();
                const reader = new FileReader();
                await reader.readAsDataURL(responseData);
                /* reads data as base64 image and saves it in a list.*/
                await reader.onloadend = function () {
                    /*                                                                                                                                  . .
                    I removed:
                    settingsAndImages["images"][key] = reader.result
                    because I was getting a null is not an object error or can't change a mutable object error. I have no idea
                    why I was getting it on images but not on settings, but it was sure happening. So I just lumped the image
                    in with settings
                    */
                    images[key] = reader.result
                }
            }
        }
    }else{
        console.log("not downloading images")
    }

    await finalSettings()
}


function handleError(err, lineNumber="none"){
    console.log("Error on line")
    console.log(lineNumber)
    Alert.alert("Error Getting Data", "Please restart your app or try again later.\nError code "
        + lineNumber,[null],
        {cancelable: false}
    )
    errorThrown = true
    AsyncStorage.setItem("errorThrown", JSON.stringify("true"));
}


async function finalSettings(){
    /* It's a personal preference - I like having big chunks of code that do one thing to be in separate functions for my
    own personal projects.. I know this isn't standard practice, so if that's not how your company does it, I have no
    problem adapting.
    also, the reason for if(images) is because the app seems to run fine without an image, so I just made it so it
    doesn't crash if the image doesn't get saved in memory correctly for some reason..*/

    for(const key in settings){
        /*                                                                                                                              .                                .
        Sets the verificationWords to what's in the server data (from cPanel) before saving. */
        if(key !== "otherData") {
            settings[key]["misc"]["verificationWords"] = Methods.getValuesFromEachKey(recentServerData["verificationWords"][key])
        }
    }

    await AsyncStorage.setItem("settings", JSON.stringify(settings))
        .catch(err => handleError(err, 15));
    if(images) {
        await AsyncStorage.setItem("images", JSON.stringify(images))
            .catch(err => handleError(err, 16));
    }
    global.stores = settings;
    /* Using global variables is NOT standard practice for react native development. Data is usually passed through
    props, which is how the majority of data is passed between screens. Because much of the styling
    is done through this JSON object, errors will be thrown if it's passed as a prop. That, combined with an emphasis
    on getting the initial live testing done as quick as possible, is why a global variable is used here. */
    if(images){
        for(const key in images){
            if(key in global.stores) {
                global.stores[key]["image"] = images[key]
            }
        }
    }
    console.log("final settings done");
    if(!errorThrown){
        AsyncStorage.setItem("errorThrown", JSON.stringify("false"))
    }
}

function resetResponses(){
    promiseResponse = null
    responseData = null
}