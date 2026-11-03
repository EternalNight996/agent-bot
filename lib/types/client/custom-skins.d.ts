export interface CustomSkin {
    readonly id: string;
    readonly name: string;
    readonly art: string;
    readonly background: string;
    readonly theme: string;
}
export declare function addCustomSkin(name: string, art: string, background: string, theme: string): CustomSkin | undefined;
export declare function removeCustomSkin(id: string): void;
export declare function useCustomSkins(): readonly CustomSkin[];
