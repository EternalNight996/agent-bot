export interface CustomSkin {
    readonly id: string;
    readonly name: string;
    readonly art: string;
    readonly background: string;
}
export declare function addCustomSkin(name: string, art: string, background: string): CustomSkin | undefined;
export declare function removeCustomSkin(id: string): void;
export declare function allCustomSkins(): readonly CustomSkin[];
export declare function useCustomSkins(): readonly CustomSkin[];
