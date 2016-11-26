"use strict";

const DocUtils = require("./docUtils");
const extensionRegex = /[^.]+\.([^.]+)/;

module.exports = class ImgManager {
	constructor(zip, fileName, xmlDocuments) {
		this.zip = zip;
		this.xmlDocuments = xmlDocuments;
		const relsFileName = this.getRelsFile(fileName);
		this.relsDoc = xmlDocuments[relsFileName] || this.createEmptyRelsDoc(xmlDocuments, relsFileName);
	}
	getRelsFile(fileName) {
		let fileParts = fileName.split("/");
		fileParts[fileParts.length - 1] = fileParts[fileParts.length - 1] + ".rels";
		fileParts = [fileParts[0], "_rels"].concat(fileParts.slice(1));
		return fileParts.join("/");
	}
	createEmptyRelsDoc(xmlDocuments, relsFileName) {
		const file = this.zip.files["word/_rels/document.xml.rels"];
		const content = DocUtils.decodeUtf8(file.asText());
		const relsDoc = DocUtils.str2xml(content);
		const relationships = relsDoc.getElementsByTagName("Relationships")[0];
		const relationshipChilds = relationships.getElementsByTagName("Relationship");
		for (let i = 0, l = relationshipChilds.length; i < l; i++) {
			relationships.removeChild(relationshipChilds[i]);
		}
		xmlDocuments[relsFileName] = relsDoc;
		return relsDoc;
	}
	loadImageRels() {
		const iterable = this.relsDoc.getElementsByTagName("Relationship");
		return Array.prototype.reduce.call(iterable, function (max, relationship) {
			const id = relationship.getAttribute("Id");
			if (/^rId[0-9]+$/.test(id)) {
				return Math.max(max, parseInt(id.substr(3), 10));
			}
			return max;
		}, 0);
	}
// Add an extension type in the [Content_Types.xml], is used if for example you want word to be able to read png files (for every extension you add you need a contentType)
	addExtensionRels(contentType, extension) {
		const contentTypeDoc = this.xmlDocuments["[Content_Types].xml"];
		const defaultTags = contentTypeDoc.getElementsByTagName("Default");
		const extensionRegistered = Array.prototype.some.call(defaultTags, function (tag) {
			return tag.getAttribute("Extension") === extension;
		});
		if (extensionRegistered) {
			return;
		}
		const types = contentTypeDoc.getElementsByTagName("Types")[0];
		const newTag = contentTypeDoc.createElement("Default");
		newTag.namespaceURI = null;
		newTag.setAttribute("ContentType", contentType);
		newTag.setAttribute("Extension", extension);
		types.appendChild(newTag);
	}
	// Add an image and returns it's Rid
	addImageRels(imageName, imageData, i) {
		if (i == null) {
			i = 0;
		}
		const realImageName = i === 0 ? imageName : imageName + `(${i})`;
		if (this.zip.files[`word/media/${realImageName}`] != null) {
			return this.addImageRels(imageName, imageData, i + 1);
		}
		const image = {
			name: `word/media/${realImageName}`,
			data: imageData,
			options: {
				binary: true,
			},
		};
		this.zip.file(image.name, image.data, image.options);
		const extension = realImageName.replace(extensionRegex, "$1");
		this.addExtensionRels(`image/${extension}`, extension);
		const relationships = this.relsDoc.getElementsByTagName("Relationships")[0];
		const newTag = this.relsDoc.createElement("Relationship");
		newTag.namespaceURI = null;
		const maxRid = this.loadImageRels() + 1;
		newTag.setAttribute("Id", `rId${maxRid}`);
		newTag.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image");
		newTag.setAttribute("Target", `media/${realImageName}`);
		relationships.appendChild(newTag);
		return maxRid;
	}
};
