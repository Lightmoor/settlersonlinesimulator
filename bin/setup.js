/*

Run using jrunscript from project root. E.g.:
  jrunscript bin\setup.js

Downloads selenium server and chrome driver and ie driver into ./tmp

Unpacks chrome driver and ie driver.

NOTE! Uses Windows-specific commands such as 'cmd' and 'copy'.

*/

// CONFIG

// config for the script
var config = {
    selenium: {
        server: {
            url: "http://selenium.googlecode.com/files/selenium-server-standalone-2.38.0.jar"
        },
        chromedriver: {
            url: "http://chromedriver.storage.googleapis.com/2.7/chromedriver_win32.zip"
        },
        iedriver: {
            url: "https://selenium.googlecode.com/files/IEDriverServer_Win32_2.38.0.zip"
        }
    },
    sonar: {
        server: {
            url: "http://dist.sonar.codehaus.org/sonar-3.7.3.zip"
        },
        runner: {
            url: "http://repo1.maven.org/maven2/org/codehaus/sonar/runner/sonar-runner-dist/2.3/sonar-runner-dist-2.3.zip"
        },
        javascript: {
            url: "http://repository.codehaus.org/org/codehaus/sonar-plugins/javascript/sonar-javascript-plugin/1.4/sonar-javascript-plugin-1.4.jar"
        }
    }
};

// If you have local copies of the required files, set them here and set useLocal=true.
var useLocal = true;
if (useLocal) {
    config.selenium.server.url = "file:///X:/backup/apps/dev/testing/selenium-server-standalone-2.38.0.jar";
    config.selenium.chromedriver.url = "file:///X:/backup/apps/dev/testing/chromedriver/2.7/chromedriver_win32.zip";
    config.selenium.iedriver.url = "file:///X:/backup/apps/dev/testing/iedriver/IEDriverServer_Win32_2.38.0.zip";
    config.sonar.server.url = "file:///X:/backup/apps/dev/testing/sonar/sonar-3.7.3.zip";
    config.sonar.runner.url = "file:///X:/backup/apps/dev/testing/sonar/sonar-runner-dist-2.3.zip";
    config.sonar.javascript.url = "file:///X:/backup/apps/dev/testing/sonar/sonar-javascript-plugin-1.4.jar";
}

// IMPORTS

importClass(java.lang.System);
importPackage(java.io);
importPackage(java.net);
importPackage(java.nio.channels);
importPackage(java.util);

// UTIL

function isInPath(path) {
    var SEP = File.pathSeparator;
    var env = System.getenv();
    for (var it = env.entrySet().iterator(); it.hasNext(); ) {
        var entry = it.next();
        if ("path" == entry.key.toLowerCase()) {
            return entry.value.split(SEP).indexOf(path) > -1;
        }
    }
    return false;
}

function urlFilename(url) {
    // ensure js string
    url += "";
    return url.substring(url.lastIndexOf('/') + 1, url.length);
}

function removeExtension(filename) {
    return new java.lang.String(filename).replaceFirst("[.][^.]+$", "");
}

function download(url, file) {
    var website = new URL(url);
    var rbc = Channels.newChannel(website.openStream());
    var fos = new FileOutputStream(file);
    fos.getChannel().transferFrom(rbc, 0, java.lang.Long.MAX_VALUE);
    return true;
}

function maybeDownload(url, file) {
    if (!file.exists()) {
        return download(url, file);
    }
    return false;
}

function doCommandIn(dir, command) {
    exec('cmd /c cd ' + dir + ' && ' + command);
}

function unzip(zip) {
    var dir = zip.getParentFile().getAbsolutePath();
    doCommandIn(dir, 'jar xvf ' + zip.getName());
}

function copy(from, to) {
    doCommand();
}




// START

var f = new File(".");
var tmp = new File(f, "tmp");

tmp.mkdirs();

/**
 * - Downloads the sonar zip.
 * - Expects the sonar extraction folder to be the same name as the zip name (with .zip removed).
 * - If the sonar extraction folder does not exist, extract the sonar zip.
 */
function downloadAndInstallSonar() {
    var sonarZip = new File(tmp, urlFilename(config.sonar.server.url));
    var sonarJavascriptJar = new File(tmp, urlFilename(config.sonar.javascript.url));

    var foldername = removeExtension(sonarZip.getName());
    var folder = new File(sonarZip.getParentFile(), foldername);
    if (!folder.exists()) {
        maybeDownload(config.sonar.server.url, sonarZip);
        // Windows-specific!
        unzip(sonarZip);
    } else {
        println('Not downloading ' + config.sonar.server.url + ' as it seems it has already been extracted here ' + folder.getAbsolutePath() + '.\n');
    }

    maybeDownload(config.sonar.javascript.url, sonarJavascriptJar);
}

function downloadAndInstallSeleniumAndDrivers() {
    var seleniumJar = new File(tmp, urlFilename(config.selenium.server.url));
    var chromeDriverZip = new File(tmp, urlFilename(config.selenium.chromedriver.url));
    var ieDriverZip = new File(tmp, urlFilename(config.selenium.iedriver.url));

    maybeDownload(config.selenium.server.url, seleniumJar);
    maybeDownload(config.selenium.chromedriver.url, chromeDriverZip);
    maybeDownload(config.selenium.iedriver.url, ieDriverZip);

    // Windows-specific!
    // Overwrite existing drivers and selenium server.
    unzip(chromeDriverZip);
    unzip(ieDriverZip);
}

downloadAndInstallSeleniumAndDrivers();
downloadAndInstallSonar();

var chromeDriverExe = new File(tmp, "chromedriver.exe");

println('Now you MAYBE need to add chromedriver and/or iedriver to PATH (if it is not already there).');
println("This is not required if you pass the webdriver.chrome.driver and/or webdriver.ie.driver options to selenium-server-standalone.jar");
println("  (and isn't required in the provided bin/start-selenium.bat script)");
println('E.g.');
println('SET PATH=%PATH%' + System.getProperty("path.separator") + chromeDriverExe.getParentFile().getAbsolutePath());
println('');
println('You MAYBE need to alter the bin/ scripts to point to the version of selenium downloaded.');
