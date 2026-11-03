import { type CaptainSkinId } from './artwork.ts';
export declare const CAPTAIN_SKIN_OPTIONS: {
    id: "hongjun" | "pangu" | "nuwa";
    name: string;
    art: string;
}[];
export declare function setCaptainSkin(id: CaptainSkinId): void;
export declare function useCaptainSkin(): {
    readonly id: CaptainSkinId;
    readonly name: string;
    readonly art: string;
};
