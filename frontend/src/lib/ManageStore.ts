import { create } from 'zustand'
import { BlueRitoLabelAutoLikeSettings, BlueRitoLabelAutoLike, BlueRitoLabelAutoPost } from '@/lexicons/index';
import { AppBskyLabelerService, } from '@atcute/bluesky';

export type BlueRitoLabelAutoLikeWithRkey = BlueRitoLabelAutoLike.Main & {
  rkey: string; // 追加するフィールド
};

export type BlueRitoLabelAutoPostWithRkey = BlueRitoLabelAutoPost.Main & {
  rkey: string; // 追加するフィールド
};

type ManageStore = {
  labelerDef: AppBskyLabelerService.Main | null
  likeSettings: BlueRitoLabelAutoLikeSettings.Main | null
  like: BlueRitoLabelAutoLikeWithRkey[]
  post: BlueRitoLabelAutoPostWithRkey[]
  useLike: boolean

  setLabelerDef: (v: AppBskyLabelerService.Main | null) => void
  setLikeSettings: (v: BlueRitoLabelAutoLikeSettings.Main | null) => void
  setLike: (v: BlueRitoLabelAutoLikeWithRkey[]) => void
  setPost: (v: BlueRitoLabelAutoPostWithRkey[]) => void
  setUseLike: (v: boolean) => void
}

export const useManageStore = create<ManageStore>((set) => ({
  labelerDef: null,
  likeSettings: null,
  like: [],
  post: [],
  useLike: false,

  setLabelerDef: (labelerDef) => set({ labelerDef }),
  setLikeSettings: (likeSettings) => set({ likeSettings }),
  setLike: (like) => set({ like }),
  setUseLike: (useLike) => set({ useLike }),
  setPost: (post) => set({ post }),
}))
