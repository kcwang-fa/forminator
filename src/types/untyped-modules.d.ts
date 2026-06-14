// 沒有附 TypeScript 型別定義的第三方模組，在這裡補最小宣告。
// 沒有這個檔案，tsc 會在 import 時報「找不到模組的型別宣告」。

// docxtemplater 免費版圖片模組：把模板裡的 {%tag} 換成圖片。
// 建構參數：getImage 回傳圖片二進位、getSize 回傳 [寬, 高]（px）。
declare module 'docxtemplater-image-module-free' {
  interface ImageModuleOptions {
    centered: boolean;
    getImage: (tagValue: string, tagName?: string) => Uint8Array;
    getSize: (img: Uint8Array, tagValue: string, tagName?: string) => [number, number];
  }
  // docxtemplater 的 module 介面沒有公開型別，用 object 即可（只會被塞進 modules 陣列）
  export default class ImageModule {
    constructor(options: ImageModuleOptions);
  }
}

// docxtemplater 官方修復模組：多張圖時避免 docPr id 重複造成 Word 報「內容有問題」。
// 匯出的是現成的 module 物件，直接放進 modules 陣列。
declare module 'docxtemplater/js/modules/fix-doc-pr-corruption.js' {
  const fixDocPrCorruption: object;
  export default fixDocPrCorruption;
}
