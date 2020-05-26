import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { resolve } from 'dns';
import { rejects } from 'assert';
import { read } from 'fs';
import { debug } from "util";

class EntityReference {
    id: string;
    typeName: string;
    constructor(typeName: string, id: string) {
        this.id = id;
        this.typeName = typeName;
    }
}

class AttachedFile implements ComponentFramework.FileObject {
    annotationId: string;
    fileContent: string;
    fileSize: number;
    fileName: string;
    mimeType: string;
    constructor(annotationId: string, fileName: string, mimeType: string, fileContent: string, fileSize: number) {
        this.annotationId = annotationId
        this.fileName = fileName;
        this.mimeType = mimeType;
        this.fileContent = fileContent;
        this.fileSize = fileSize;
    }
}

export class VideoComponent implements ComponentFramework.StandardControl<IInputs, IOutputs> {

	/**
	 * Empty constructor.
	 */
    private entityReference: EntityReference;
    private _context: ComponentFramework.Context<IInputs>;
    constructor() {
    }

	/**
	 * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
	 * Data-set values are not initialized here, use updateView.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
	 * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
	 * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
	 * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
	 */
    public init(context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement) {

        this._context = context;
        this.entityReference = new EntityReference(
            (<any>context).page.entityTypeName,
            (<any>context).page.entityId
        )

        // const labelUpload = document.createElement('label');
        // labelUpload.innerHTML = 'Upload Video: ';
        // container.appendChild(labelUpload);

        const uploadInput = document.createElement('input');
        uploadInput.id = 'fileUpload';
        uploadInput.type = 'file';
        uploadInput.accept = 'video/*';
        uploadInput.setAttribute('style',
            'opacity:1;width:30%;height:20px;position:inherit;pointer-events:inherit;');
        container.appendChild(uploadInput);

        const uploadBtn = document.createElement('button');
        uploadBtn.innerHTML = 'Upload Video';
        uploadBtn.onclick = () => this.uploadFn();
        container.appendChild(uploadBtn);        

        const hrElement = document.createElement('hr');
        container.appendChild(hrElement);

        // Add control initialization code
        const videoElement = document.createElement('video');
        videoElement.id = 'videoElement';
        videoElement.width = 500;
		videoElement.height = 300;
        videoElement.controls = true;

        const sourceElement = document.createElement('source');
        sourceElement.id = 'elementPlayer';
        sourceElement.src = '';
        sourceElement.type = 'video/mp4';

        videoElement.appendChild(sourceElement);

        container.appendChild(videoElement);
    }

    private toBase64String = (file: File,
        successFn: (file: File, body: string) => void) => {       
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => successFn(file, reader.result as string);
        return reader.result;
    };

    uploadFn = (): void => {
        debugger;
        const fileUpload = document.getElementById('fileUpload') as HTMLInputElement;
        let files = fileUpload.files;
        const valid = fileUpload.files && fileUpload.files.length > 0;
        if (!valid) {
            alert('Please select the video file!');
            return;
        }
        const file = fileUpload.files[0];
        if (files![0].type != 'video/mp4') {
            alert('Please attach only mp4 file!');
            return;
        }

        this.toBase64String(file, (file: File, text: string) => {
            const type = file.type;
            this.renderToPlayer(text, type); 
            let notesEntity = new AttachedFile("", file.name, type, text, file.size);
           this.addAttachments(notesEntity);
        });

    };

    renderToPlayer = (body, type): void => {
        debugger;
        const videoElement = document.getElementById('videoElement') as
            HTMLVideoElement;
        document.getElementById('elementPlayer').remove();

        const sourceElement = document.createElement('source');
        sourceElement.id = 'elementPlayer';
        sourceElement.src = body;
        sourceElement.type = type;
        videoElement.appendChild(sourceElement);

        videoElement.load();
        console.log('body ' + body);
        console.log(type);

    };

    showToPlayer = (context: ComponentFramework.Context<IInputs>,
        id: string): void => {
        const notes = context.webAPI.retrieveRecord('annotation', id).
            then((attachment) => {
                const body = attachment.documentbody;
                const type = attachment.mimetype;
                this.renderToPlayer(body, type);
            });
    };

    addAttachments = (file: AttachedFile): void => {
        debugger;
        var notesEntity: any = {}
        var fileContent = file.fileContent.replace("data:video/mp4;base64,", "");
        notesEntity["documentbody"] = fileContent;
        notesEntity["filename"] = file.fileName;
        notesEntity["filesize"] = file.fileSize;
        notesEntity["mimetype"] = file.mimeType;
        notesEntity["subject"] = file.fileName;
        notesEntity["notetext"] = "Video Attachment";
        notesEntity["objecttypecode"] = this.entityReference.typeName;
        notesEntity[`objectid_${this.entityReference.typeName}@odata.bind`] = `/${this.CollectionNameFromLogicalName(this.entityReference.typeName)}(${this.entityReference.id})`;
        let thisRef = this;

        // Invoke the Web API to creat the new record
        this._context.webAPI.createRecord("annotation", notesEntity).then
            (
                function (response: ComponentFramework.EntityReference) {
                    // Callback method for successful creation of new record
                    console.log(response);

                    // Get the ID of the new record created
                    notesEntity["annotationId"] = response.id;
                    notesEntity["fileContent"] = file.fileContent;
                    notesEntity["fileName"] = notesEntity["filename"];
                    //this.renderToPlayer(file.fileContent, file.mimeType);
                    alert("Uploaded video successfully!!");
                },
                function (errorResponse: any) {
                    // Error handling code here - record failed to be created
                    console.log(errorResponse);
                    alert("Unable to uploaded video!!");
                }
            );
    };

    CollectionNameFromLogicalName = (entityLogicalName: string): string => {
        if (entityLogicalName[entityLogicalName.length - 1] != 's') {
            return `${entityLogicalName}s`;
        } else {
            return `${entityLogicalName}es`;
        }
    };

	/**
	 * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
	 */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        // Add code to update control view
    }

	/** 
	 * It is called by the framework prior to a control receiving new data. 
	 * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as “bound” or “output”
	 */
    public getOutputs(): IOutputs {
        return {};
    }

	/** 
	 * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
	 * i.e. cancelling any pending remote calls, removing listeners, etc.
	 */
    public destroy(): void {
        // Add code to cleanup control if necessary
    }
}