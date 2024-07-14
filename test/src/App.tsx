import "./App.css";
import { HFS, LocalAdapter } from "@hfs";
import { demoFS } from "./demo-fs";
import { TreeView } from "./tree-view";

const adapter = new LocalAdapter(demoFS);

function App() {
    return (
        <>
            RTest
            <HFS adapter={adapter}>
                <div>Headless FS</div>
                <TreeView path="/" />
            </HFS>
        </>
    );
}

export default App;
