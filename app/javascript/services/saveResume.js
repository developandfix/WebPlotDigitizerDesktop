/*
    WebPlotDigitizer - https://automeris.io/WebPlotDigitizer

    Copyright 2010-2024 Ankit Rohatgi <ankitrohatgi@hotmail.com>

    This file is part of WebPlotDigitizer.

    WebPlotDigitizer is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    WebPlotDigitizer is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with WebPlotDigitizer.  If not, see <http://www.gnu.org/licenses/>.
*/

var wpd = wpd || {};

wpd.saveResume = (function() {
    let currentProjectPath = null;
    let currentProjectName = "wpd_project";

    function isElectronRuntime() {
        return typeof window.wpdDesktop !== "undefined" && window.wpdDesktop.isDesktopApp === true;
    }

    function getDesktopBridge() {
        if (!isElectronRuntime()) {
            return null;
        }
        return window.wpdDesktop;
    }

    function getBasename(filePath) {
        return filePath.split(/[\\/]/).pop();
    }

    function getFileStem(filePath) {
        const base = getBasename(filePath);
        const dotIndex = base.lastIndexOf(".");
        if (dotIndex <= 0) {
            return base;
        }
        return base.slice(0, dotIndex);
    }

    function updateWindowTitle() {
        if (isElectronRuntime()) {
            const filename = currentProjectPath == null ? "Untitled" : getBasename(currentProjectPath);
            document.title = "WebPlotDigitizer - " + filename;
        }
    }

    function save() {
        if (isElectronRuntime()) {
            saveDesktopProject();
            return;
        }
        wpd.popup.show('export-json-window');
    }

    function saveAs() {
        if (isElectronRuntime()) {
            saveDesktopProjectAs();
            return;
        }
        wpd.popup.show('export-json-window');
    }

    function load() {
        if (isElectronRuntime()) {
            openDesktopProject();
            return;
        }
        wpd.popup.show('import-json-window');
    }

    function resumeFromJSON(json_data) {
        const plotData = wpd.appData.getPlotData();
        const metadata = plotData.deserialize(json_data);
        _loadMetadata(metadata);
        wpd.tree.refresh();
    }

    function generateJSON() {
        const plotData = wpd.appData.getPlotData();
        const metadata = wpd.appData.getFileManager().getMetadata();
        return JSON.stringify(plotData.serialize(metadata));
    }

    function _loadMetadata(metadata) {
        let data = {};
        if (metadata && Object.keys(metadata).length !== 0) {
            data = metadata;
        }
        wpd.appData.getFileManager().loadMetadata(data);
    }

    function stripIllegalCharacters(filename) {
        return filename.replace(/[^a-zA-Z\d+\.\-_\s]/g, "_");
    }

    function downloadJSON() {
        let projectName =
            stripIllegalCharacters(document.getElementById("project-name-input").value) + ".json";

        wpd.download.json(generateJSON(), projectName);
        wpd.popup.close('export-json-window');
    }

    function _writeAndDownloadTar(projectName, json, imageFiles, imageFileNames) {
        let projectInfo =
            JSON.stringify({
                'version': [4, 0],
                'json': 'wpd.json',
                'images': imageFileNames
            });

        let tarWriter = new tarball.TarWriter();
        tarWriter.addFolder(projectName + '/');
        tarWriter.addTextFile(projectName + '/info.json', projectInfo);
        tarWriter.addTextFile(projectName + '/wpd.json', json);
        for (let i = 0; i < imageFiles.length; i++) {
            tarWriter.addFile(projectName + '/' + imageFileNames[i], imageFiles[i]);
        }
        return tarWriter.download(projectName + '.tar');
    }

    function downloadProject() {
        const projectName =
            stripIllegalCharacters(document.getElementById('project-name-input').value);

        const json = generateJSON();

        wpd.busyNote.show();
        wpd.graphicsWidget.getImageFiles().then(imageFiles => {
            const imageFileNames = imageFiles.map(file => file.name);
            _writeAndDownloadTar(projectName, json, imageFiles, imageFileNames).then(
                wpd.busyNote.close()
            );
        });
        wpd.popup.close('export-json-window');
    }

    function readJSONFileOnly(jsonFile) {
        var fileReader = new FileReader();
        fileReader.onload = function() {
            var json_data = JSON.parse(fileReader.result);
            resumeFromJSON(json_data);

            wpd.graphicsWidget.resetData();
            wpd.graphicsWidget.removeTool();
            wpd.graphicsWidget.removeRepainter();
            wpd.tree.refresh();
            wpd.messagePopup.show(wpd.gettext('import-json'), wpd.gettext("json-data-loaded"));
            afterProjectLoaded();
        };
        fileReader.readAsText(jsonFile);
    }

    function readProjectFile(file) {
        return new Promise((resolve, reject) => {
            wpd.busyNote.show();
            var tarReader = new tarball.TarReader();
            tarReader.readFile(file).then(
                function(fileInfo) {
                    const infoIndex = fileInfo.findIndex(info => info.name.endsWith('/info.json'));
                    if (infoIndex < 0) {
                        wpd.busyNote.close();
                        reject(new Error("Invalid project file format"));
                        return;
                    }

                    const projectName = fileInfo[infoIndex].name.replace('/info.json', '');

                    let wpdimages = [];
                    fileInfo.filter((info) => {
                        return info.type === 'file' && !info.name.endsWith('.json');
                    }).forEach((info) => {
                        let mimeType = '';
                        if (info.name.endsWith('.pdf')) {
                            mimeType = 'application/pdf';
                        } else {
                            mimeType = 'image/png';
                        }
                        const nameRegexp = new RegExp(projectName + '/', 'i');
                        const wpdimage = tarReader.getFileBlob(info.name, mimeType);
                        wpdimage.name = info.name.replace(nameRegexp, '');
                        wpdimages.push(wpdimage);
                    });

                    let wpdjson = JSON.parse(tarReader.getTextFile(projectName + '/wpd.json'));

                    wpd.imageManager.initializeFileManager(wpdimages);
                    wpd.imageManager.loadFromFile(wpdimages[0], true).then(() => {
                        wpd.busyNote.close();
                        resumeFromJSON(wpdjson);
                        wpd.tree.refresh();
                        wpd.messagePopup.show(wpd.gettext('import-json'),
                            wpd.gettext('json-data-loaded'));
                        afterProjectLoaded();
                        resolve();
                    }).catch((err) => {
                        wpd.busyNote.close();
                        reject(err);
                    });
                },
                function(err) {
                    wpd.busyNote.close();
                    reject(err);
                });
        });
    }

    function afterProjectLoaded() {
        const plotData = wpd.appData.getPlotData();
        if (plotData.getDatasetCount() > 0) {
            wpd.tree.selectPath("/" + wpd.gettext("datasets"));
        }
    }

    function read() {
        const $fileInput = document.getElementById('import-json-file');
        wpd.popup.close('import-json-window');
        if ($fileInput.files.length === 1) {
            let file = $fileInput.files[0];
            let fileType = file.type;
            if (fileType == "" || fileType == null) {
                if (file.name.endsWith(".json")) {
                    fileType = "application/json";
                } else if (file.name.endsWith(".tar")) {
                    fileType = "application/x-tar";
                }
            }
            if (fileType == "application/json") {
                readJSONFileOnly(file);
            } else if (fileType == "application/x-tar") {
                readProjectFile(file);
            } else {
                wpd.messagePopup.show(wpd.gettext("invalid-project"),
                    wpd.gettext("invalid-project-msg"));
            }
        }
    }

    function ensureTarExtension(filePath) {
        if (filePath.toLowerCase().endsWith(".tar")) {
            return filePath;
        }
        return filePath + ".tar";
    }

    async function writeProjectTarToPath(projectPath) {
        const desktopBridge = getDesktopBridge();
        const normalizedPath = ensureTarExtension(projectPath);
        const projectNameFromPath = stripIllegalCharacters(getFileStem(normalizedPath));
        const projectName = projectNameFromPath === "" ? "wpd_project" : projectNameFromPath;

        const json = generateJSON();
        const imageFiles = await wpd.graphicsWidget.getImageFiles();
        const imageFileNames = imageFiles.map((file, idx) => {
            if (file.name == null || file.name === "") {
                return "image_" + (idx + 1) + ".png";
            }
            return getBasename(file.name);
        });
        const projectInfo = JSON.stringify({
            version: [4, 0],
            json: "wpd.json",
            images: imageFileNames
        });

        let tarWriter = new tarball.TarWriter();
        tarWriter.addFolder(projectName + '/');
        tarWriter.addTextFile(projectName + '/info.json', projectInfo);
        tarWriter.addTextFile(projectName + '/wpd.json', json);
        for (let i = 0; i < imageFiles.length; i++) {
            tarWriter.addFile(projectName + '/' + imageFileNames[i], imageFiles[i]);
        }

        const tarBytes = await tarWriter.write();
        await desktopBridge.writeBinaryFile(normalizedPath, tarBytes);

        currentProjectPath = normalizedPath;
        currentProjectName = projectName;
        updateWindowTitle();
    }

    async function openProjectFromPath(projectPath) {
        const desktopBridge = getDesktopBridge();
        const fileBuffer = await desktopBridge.readBinaryFile(projectPath);
        const filename = getBasename(projectPath);
        const file = new File([fileBuffer], filename, { type: "application/x-tar" });
        await readProjectFile(file);
        currentProjectPath = projectPath;
        currentProjectName = stripIllegalCharacters(getFileStem(filename));
        updateWindowTitle();
    }

    async function openDesktopProject() {
        const desktopBridge = getDesktopBridge();
        if (desktopBridge == null) {
            return;
        }
        const projectPath = await desktopBridge.showOpenProjectDialog();
        if (projectPath == null) {
            return;
        }
        try {
            await openProjectFromPath(projectPath);
        } catch (err) {
            console.log(err);
            wpd.messagePopup.show(wpd.gettext("invalid-project"),
                wpd.gettext("invalid-project-msg"));
        }
    }

    async function saveDesktopProjectAs() {
        const desktopBridge = getDesktopBridge();
        if (desktopBridge == null) {
            return;
        }

        const suggestedName = currentProjectName === "" ? "wpd_project.tar" : currentProjectName + ".tar";
        const defaultPath = currentProjectPath == null ? suggestedName : currentProjectPath;
        const savePath = await desktopBridge.showSaveProjectDialog(defaultPath);
        if (savePath == null) {
            return;
        }

        wpd.busyNote.show();
        try {
            await writeProjectTarToPath(savePath);
        } catch (err) {
            console.log(err);
            wpd.messagePopup.show(wpd.gettext("invalid-project"),
                "Unable to save project file.");
        } finally {
            wpd.busyNote.close();
        }
    }

    async function saveDesktopProject() {
        if (currentProjectPath == null) {
            await saveDesktopProjectAs();
            return;
        }
        wpd.busyNote.show();
        try {
            await writeProjectTarToPath(currentProjectPath);
        } catch (err) {
            console.log(err);
            wpd.messagePopup.show(wpd.gettext("invalid-project"),
                "Unable to save project file.");
        } finally {
            wpd.busyNote.close();
        }
    }

    function registerDesktopMenuActions() {
        const desktopBridge = getDesktopBridge();
        if (desktopBridge == null) {
            return;
        }

        desktopBridge.onNativeMenuAction((action) => {
            if (action === "open-project") {
                openDesktopProject();
            } else if (action === "save-project") {
                saveDesktopProject();
            } else if (action === "save-project-as") {
                saveDesktopProjectAs();
            } else if (action === "load-image") {
                wpd.popup.show("loadNewImage");
            } else if (action === "show-about") {
                wpd.popup.show("helpWindow");
            }
        });
    }

    registerDesktopMenuActions();
    updateWindowTitle();

    return {
        save: save,
        saveAs: saveAs,
        load: load,
        openProject: openDesktopProject,
        downloadJSON: downloadJSON,
        downloadProject: downloadProject,
        read: read,
        readProjectFile: readProjectFile
    };
})();
