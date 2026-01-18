export const scanFiles = async (item, path = "") => {
    if (item.isFile) {
        return new Promise((resolve) => {
            item.file((file) => {
                // Manually add webkitRelativePath property for consistency with input[type="file"]
                Object.defineProperty(file, "webkitRelativePath", {
                    value: path + file.name,
                });
                resolve([file]);
            });
        });
    } else if (item.isDirectory) {
        const dirReader = item.createReader();
        const entries = await new Promise((resolve) => {
            dirReader.readEntries((entries) => resolve(entries));
        });

        const files = await Promise.all(
            entries.map((entry) => scanFiles(entry, path + item.name + "/"))
        );
        return files.flat();
    }
    return [];
};

export const processDropItems = async (dataTransfer) => {
    const items = dataTransfer.items;
    if (items && items.length > 0) {
        const filesPromises = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry();
            if (item) {
                filesPromises.push(scanFiles(item));
            }
        }
        return (await Promise.all(filesPromises)).flat();
    } else if (dataTransfer.files?.length > 0) {
        return Array.from(dataTransfer.files);
    }
    return [];
};
