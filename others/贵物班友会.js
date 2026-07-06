// ==UserScript==
// @name         bangumi贵物班友会（改）
// @namespace    http://tampermonkey.net/
// @version      1.1.5
// @description  老悠贵物班友会不那么单机版，可以通过点击评论右侧三个点发送点评到邮箱，加入淳朴度点评
// @author       weiy（原作者：老悠）
// @include      https://bgm.tv/*
// @include      https://bangumi.tv/*
// @match        https://chii.in/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/520566/bangumi%E8%B4%B5%E7%89%A9%E7%8F%AD%E5%8F%8B%E4%BC%9A%EF%BC%88%E6%94%B9%EF%BC%89.user.js
// @updateURL https://update.greasyfork.org/scripts/520566/bangumi%E8%B4%B5%E7%89%A9%E7%8F%AD%E5%8F%8B%E4%BC%9A%EF%BC%88%E6%94%B9%EF%BC%89.meta.js
// ==/UserScript==


(function() {
    'use strict';

    // 用户数据映射
    const userDataMap = {
        "822795": {
            "username": "822795",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1719916442000,
                "modifier": 1,
                "modified": 1733397947000,
                "extra": null,
                "id": 78,
                "masterId": null,
                "master": null,
                "name": "随风",
                "bgmid": "822795",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "急急国王\nhttps://bgm.tv/group/topic/401201#post_2790423",
                "mcs": []
            }
        },
        "jsgfshakak": {
            "username": "jsgfshakak",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711414605000,
                "modifier": 1,
                "modified": 1733397740000,
                "extra": null,
                "id": 22,
                "masterId": null,
                "master": null,
                "name": "技术规范书阿卡卡",
                "bgmid": "690372",
                "newbgmid": "jsgfshakak",
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "性焦虑卡卡，极度仇日的老保，但看着像是cos\n\n原神刷帖机\nhttps://bgm.tv/group/topic/409522\nhttps://bgm.tv/group/topic/409526\nhttps://bgm.tv/group/topic/409528\nhttps://bgm.tv/group/topic/409529\nhttps://bgm.tv/group/topic/409530",
                "mcs": []
            }
        },
        "447420": {
            "username": "447420",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711414059000,
                "modifier": 1,
                "modified": 1733397727000,
                "extra": null,
                "id": 18,
                "masterId": null,
                "master": null,
                "name": "sa君",
                "bgmid": "447420",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "社科高中生",
                "mcs": []
            }
        },
        "cyancat": {
            "username": "cyancat",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1730122673000,
                "modifier": 1,
                "modified": 1733447846000,
                "extra": null,
                "id": 122,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "609137",
                "newbgmid": "cyancat",
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "609844": {
            "username": "609844",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711415010000,
                "modifier": 1,
                "modified": 1733397743000,
                "extra": null,
                "id": 23,
                "masterId": null,
                "master": null,
                "name": "HARU",
                "bgmid": "609844",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "循环论证\n喜欢装大善人\n\n解决不了问题，就解决提出问题的人\nhttps://bgm.tv/group/topic/406243#post_2903710\n\n反智集美不知道在急什么\nhttps://bgm.tv/group/topic/407587#post_2932340",
                "mcs": []
            }
        },
        "akb49": {
            "username": "akb49",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711354082000,
                "modifier": 1,
                "modified": 1733397671000,
                "extra": null,
                "id": 5,
                "masterId": null,
                "master": null,
                "name": "泽荣",
                "bgmid": "63429",
                "newbgmid": "akb49",
                "score": -5,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名∶老白\n巨魔公公\n被豆瓣女拳暴打",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1726154332000,
                        "modifier": 1,
                        "modified": 1726154332000,
                        "extra": null,
                        "id": 18,
                        "monsterId": 5,
                        "cliqueId": 7,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1726154226000,
                            "modifier": 1,
                            "modified": 1726154240000,
                            "extra": null,
                            "id": 7,
                            "name": "泽荣千人大群",
                            "score": -5,
                            "estTime": 1577808000000,
                            "estTimeFormat": "202?",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "以泽荣为首的养蛊群",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "高",
                            "code": "1",
                            "field": "HIGH"
                        },
                        "joinTime": 1577808000000,
                        "joinTimeFormat": "202?",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        },
                        "mCStatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        }
                    }
                ]
            }
        },
        "525775": {
            "username": "525775",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1715848699000,
                "modifier": 1,
                "modified": 1733447886000,
                "extra": null,
                "id": 67,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "525775",
                "newbgmid": null,
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "sawarin": {
            "username": "sawarin",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1728973018000,
                "modifier": 1,
                "modified": 1733398055000,
                "extra": null,
                "id": 108,
                "masterId": null,
                "master": null,
                "name": "Sawarin🎐",
                "bgmid": "734183",
                "newbgmid": "sawarin",
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "反智主义\nhttps://bgm.tv/group/topic/407528#post_2930960",
                "mcs": []
            }
        },
        "749898": {
            "username": "749898",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711354732000,
                "modifier": 1,
                "modified": 1733397705000,
                "extra": null,
                "id": 12,
                "masterId": null,
                "master": null,
                "name": "折棒真帅",
                "bgmid": "749898",
                "newbgmid": null,
                "score": -5,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "太想火了，巨魔知识学习中\n已化身为哗众取宠的引战小丑\n\n已有取古河而代之的迹象\nhttps://bgm.tv/group/topic/403050\n\n恶意修改标记篡改事实(扣一分)\nhttps://bgm.tv/group/topic/403050#post_2831674\n\n和连体兄弟吹风闹掰了\nhttps://bgm.tv/group/topic/405090\n\n前脚切割后脚AT\nhttps://bgm.tv/group/topic/405179#post_2878202",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1711354743000,
                        "modifier": 1,
                        "modified": 1711354743000,
                        "extra": null,
                        "id": 7,
                        "monsterId": 12,
                        "cliqueId": 1,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1710834557000,
                            "modifier": 1,
                            "modified": 1722579558000,
                            "extra": null,
                            "id": 1,
                            "name": "牵手家族",
                            "score": -5,
                            "estTime": 1577808000000,
                            "estTimeFormat": "202?",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "又名古家军\n现根据地为斗蛐蛐群\n以古河为首的立志于造神的“战团”型小团体\n\n内部不稳\nhttps://bgm.tv/group/topic/403050",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "中",
                            "code": "2",
                            "field": "MIDDLE"
                        },
                        "joinTime": null,
                        "joinTimeFormat": "",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "疑似加入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        },
                        "mCStatus": {
                            "desc": "疑似加入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        }
                    },
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1715339517000,
                        "modifier": 1,
                        "modified": 1715339517000,
                        "extra": null,
                        "id": 15,
                        "monsterId": 12,
                        "cliqueId": 6,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1715339481000,
                            "modifier": 1,
                            "modified": 1725774108000,
                            "extra": null,
                            "id": 6,
                            "name": "折棒吹风寝室",
                            "score": -4,
                            "estTime": 1704038400000,
                            "estTimeFormat": "2024",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "疑似脱胎于牵手家族，由折棒牵头组成\n\n折棒吹风连体婴儿闹分家，不知道离寝室解散还有多远\nhttps://bgm.tv/group/topic/405090\nhttps://bgm.tv/group/topic/405090#post_2876530\nhttps://bgm.tv/group/topic/405090#post_2876533",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "高",
                            "code": "1",
                            "field": "HIGH"
                        },
                        "joinTime": 1704038400000,
                        "joinTimeFormat": "2024",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        },
                        "mCStatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        }
                    }
                ]
            }
        },
        "chinoo": {
            "username": "chinoo",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1725266856000,
                "modifier": 1,
                "modified": 1733398005000,
                "extra": null,
                "id": 95,
                "masterId": null,
                "master": null,
                "name": "香风",
                "bgmid": "361201",
                "newbgmid": "chinoo",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "唯销量论者\nhttps://bgm.tv/group/topic/404754#post_2868589",
                "mcs": []
            }
        },
        "mrwangbote": {
            "username": "mrwangbote",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1730158298000,
                "modifier": 1,
                "modified": 1733447853000,
                "extra": null,
                "id": 126,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "233345",
                "newbgmid": "mrwangbote",
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "796402": {
            "username": "796402",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711354686000,
                "modifier": 1,
                "modified": 1733397702000,
                "extra": null,
                "id": 11,
                "masterId": null,
                "master": null,
                "name": "想带你去吹吹风",
                "bgmid": "796402",
                "newbgmid": null,
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "动了你的蛋糕\n钓鱼业障愈发靠近古河\nhttps://bgm.tv/group/topic/398110",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1711354696000,
                        "modifier": 1,
                        "modified": 1711354696000,
                        "extra": null,
                        "id": 6,
                        "monsterId": 11,
                        "cliqueId": 1,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1710834557000,
                            "modifier": 1,
                            "modified": 1722579558000,
                            "extra": null,
                            "id": 1,
                            "name": "牵手家族",
                            "score": -5,
                            "estTime": 1577808000000,
                            "estTimeFormat": "202?",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "又名古家军\n现根据地为斗蛐蛐群\n以古河为首的立志于造神的“战团”型小团体\n\n内部不稳\nhttps://bgm.tv/group/topic/403050",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "中",
                            "code": "2",
                            "field": "MIDDLE"
                        },
                        "joinTime": null,
                        "joinTimeFormat": "",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "疑似加入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        },
                        "mCStatus": {
                            "desc": "疑似加入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        }
                    },
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1715339540000,
                        "modifier": 1,
                        "modified": 1715339540000,
                        "extra": null,
                        "id": 16,
                        "monsterId": 11,
                        "cliqueId": 6,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1715339481000,
                            "modifier": 1,
                            "modified": 1725774108000,
                            "extra": null,
                            "id": 6,
                            "name": "折棒吹风寝室",
                            "score": -4,
                            "estTime": 1704038400000,
                            "estTimeFormat": "2024",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "疑似脱胎于牵手家族，由折棒牵头组成\n\n折棒吹风连体婴儿闹分家，不知道离寝室解散还有多远\nhttps://bgm.tv/group/topic/405090\nhttps://bgm.tv/group/topic/405090#post_2876530\nhttps://bgm.tv/group/topic/405090#post_2876533",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "高",
                            "code": "1",
                            "field": "HIGH"
                        },
                        "joinTime": 1704038400000,
                        "joinTimeFormat": "2024",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        },
                        "mCStatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        }
                    }
                ]
            }
        },
        "938070": {
            "username": "938070",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1732678039000,
                "modifier": 1,
                "modified": 1733398103000,
                "extra": null,
                "id": 143,
                "masterId": 31,
                "master": {
                    "status": {
                        "desc": "有效",
                        "code": "1",
                        "field": "VALID"
                    },
                    "creator": 1,
                    "created": 1711417993000,
                    "modifier": 1,
                    "modified": 1733397801000,
                    "extra": null,
                    "id": 31,
                    "masterId": null,
                    "master": null,
                    "name": "屏晶",
                    "bgmid": "742594",
                    "newbgmid": "yunease",
                    "score": -2,
                    "type": {
                        "desc": "主号",
                        "code": "1",
                        "field": "MASTER"
                    },
                    "cont": "语C小男娘\n\n屏晶的忏悔\nhttps://bgm.tv/group/topic/410552"
                },
                "name": "琴泠",
                "bgmid": "938070",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "小号",
                    "code": "2",
                    "field": "SLAVE"
                },
                "cont": "",
                "mcs": []
            }
        },
        "pfauslon": {
            "username": "pfauslon",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1712546286000,
                "modifier": 1,
                "modified": 1733397833000,
                "extra": null,
                "id": 41,
                "masterId": null,
                "master": null,
                "name": "Thor",
                "bgmid": "535873",
                "newbgmid": "pfauslon",
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "意义怪，满嘴存在主义虚无主义\n开盒同情者还找老师了\nhttps://bgm.tv/group/topic/401255#post_2789475\n\n退又不退\nhttps://bgm.tv/group/topic/402698#post_2823697\n\n自以为自己有常识的反智主义者\nhttps://bgm.tv/group/topic/407528#post_2930985",
                "mcs": []
            }
        },
        "772085": {
            "username": "772085",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1728973189000,
                "modifier": 1,
                "modified": 1733398058000,
                "extra": null,
                "id": 109,
                "masterId": null,
                "master": null,
                "name": "苏黎世",
                "bgmid": "772085",
                "newbgmid": null,
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "反智双标狗在叫\n“每当你想批评别人......并不是所有人，都有你拥有的那些优势。”\nhttps://bgm.tv/group/topic/407528#post_2931047",
                "mcs": []
            }
        },
        "866025": {
            "username": "866025",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1729769102000,
                "modifier": 1,
                "modified": 1733398085000,
                "extra": null,
                "id": 118,
                "masterId": null,
                "master": null,
                "name": "周启帆152",
                "bgmid": "866025",
                "newbgmid": null,
                "score": 0,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名：符腾堡母爵\n\n第一个改成2022的“符腾堡xx”系列昵称的用户，原因似乎是私人恩怨",
                "mcs": []
            }
        },
        "919237": {
            "username": "919237",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1731491765000,
                "modifier": 1,
                "modified": 1733398096000,
                "extra": null,
                "id": 141,
                "masterId": null,
                "master": null,
                "name": "波兰首都是上海",
                "bgmid": "919237",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "被骂到偶像就急了\nhttps://bgm.tv/group/topic/409537#post_2972902",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1731491952000,
                        "modifier": 1,
                        "modified": 1731491952000,
                        "extra": null,
                        "id": 20,
                        "monsterId": 141,
                        "cliqueId": 8,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1731491923000,
                            "modifier": 1,
                            "modified": 1731492932000,
                            "extra": null,
                            "id": 8,
                            "name": "空织小魔女群",
                            "score": -2,
                            "estTime": null,
                            "estTimeFormat": "",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "具体成分不清楚，但头子空织素质这么低想必也好不到哪去",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "未知",
                            "code": "0",
                            "field": "UNKNOWN"
                        },
                        "joinTime": 1704038400000,
                        "joinTimeFormat": "2024",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        },
                        "mCStatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        }
                    }
                ]
            }
        },
        "yuri_chan": {
            "username": "yuri_chan",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1730185861000,
                "modifier": 1,
                "modified": 1733447888000,
                "extra": null,
                "id": 128,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "909035",
                "newbgmid": "yuri_chan",
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "darkprince": {
            "username": "darkprince",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1722499616000,
                "modifier": 1,
                "modified": 1733397976000,
                "extra": null,
                "id": 87,
                "masterId": null,
                "master": null,
                "name": "pinKdicK",
                "bgmid": "452475",
                "newbgmid": "darkprince",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "抛开素质不谈，阅历也过于低了点\nhttps://bgm.tv/group/topic/403000#post_2830456",
                "mcs": []
            }
        },
        "ttk": {
            "username": "ttk",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1722357921000,
                "modifier": 1,
                "modified": 1733397963000,
                "extra": null,
                "id": 83,
                "masterId": null,
                "master": null,
                "name": "TTK",
                "bgmid": "785058",
                "newbgmid": "ttk",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "垃圾用户\nhttps://bgm.tv/group/topic/402887#post_2827478",
                "mcs": []
            }
        },
        "821365": {
            "username": "821365",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1733401941000,
                "modifier": 1,
                "modified": 1733401941000,
                "extra": null,
                "id": 147,
                "masterId": null,
                "master": null,
                "name": "KahoTAT",
                "bgmid": "821365",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "话都说不条道，还想逆练21条\nhttps://bgm.tv/blog/343569#post_290277\nhttps://bgm.tv/group/topic/411176",
                "mcs": []
            }
        },
        "893987": {
            "username": "893987",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1732789642000,
                "modifier": 1,
                "modified": 1733447876000,
                "extra": null,
                "id": 146,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "893987",
                "newbgmid": null,
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "gosickf1110": {
            "username": "gosickf1110",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1731073321000,
                "modifier": 1,
                "modified": 1733447873000,
                "extra": null,
                "id": 140,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "357460",
                "newbgmid": "gosickf1110",
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "oblivionisvagar": {
            "username": "oblivionisvagar",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1725945077000,
                "modifier": 1,
                "modified": 1733398010000,
                "extra": null,
                "id": 97,
                "masterId": null,
                "master": null,
                "name": "遗忘流浪者",
                "bgmid": "795245",
                "newbgmid": "oblivionisvagar",
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "“他只是个孩子”\nhttps://bgm.tv/group/topic/405144#post_2877158\n\n处男歧视\nhttps://bgm.tv/group/topic/405144#post_2877189",
                "mcs": []
            }
        },
        "737578": {
            "username": "737578",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1726672754000,
                "modifier": 1,
                "modified": 1733398022000,
                "extra": null,
                "id": 102,
                "masterId": null,
                "master": null,
                "name": "Mcdoler",
                "bgmid": "737578",
                "newbgmid": null,
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "帮亲不帮理，影响中国法制化的最大障碍\nhttps://bgm.tv/group/topic/405677#post_2890858",
                "mcs": []
            }
        },
        "ratman114514": {
            "username": "ratman114514",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1732496958000,
                "modifier": 1,
                "modified": 1733398099000,
                "extra": null,
                "id": 142,
                "masterId": null,
                "master": null,
                "name": "Ratman114514",
                "bgmid": "428068",
                "newbgmid": "ratman114514",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名：空格键、匿名人 士87685、已注销\n\n唉，美帝\nhttps://bgm.tv/person/61796#post_170302\n\n“恰恰”主义\nhttps://bgm.tv/group/topic/410293#post_2991110",
                "mcs": []
            }
        },
        "725176": {
            "username": "725176",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1732689104000,
                "modifier": 1,
                "modified": 1733398108000,
                "extra": null,
                "id": 145,
                "masterId": null,
                "master": null,
                "name": "高三电波台",
                "bgmid": "725176",
                "newbgmid": null,
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "是啊，回复发出来了层主是个人是条狗关你什 么事？\nhttps://bgm.tv/group/topic/410529#post_2994949",
                "mcs": []
            }
        },
        "furukawa": {
            "username": "furukawa",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711354165000,
                "modifier": 1,
                "modified": 1733972474000,
                "extra": null,
                "id": 8,
                "masterId": null,
                "master": null,
                "name": "古河",
                "bgmid": "317643",
                "newbgmid": "furukawa",
                "score": -5,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "牵手家族古家军头子\n斗蛐蛐群群主\n泛团引 流狗\n设计痕迹太重\n曾经的艾登粉丝\n有妻有女家庭和睦\n\nbangumi盲人\nhttps://bgm.tv/group/topic/402995#post_2830391\n\n在茶话会名声彻底臭了之后，其在古家军内部也受到了挑战\nhttps://bgm.tv/group/topic/403050\n\n古河开车物语，但已无当年盛况\nhttps://bgm.tv/subject/topic/31588\n\n古河改制，从社达开始的社科生活\nhttps://bgm.tv/group/topic/405803\n\n古河恐怖如斯断不能留！\nhttps://bgm.tv/group/topic/410819\n\n炸鱼技术是会退步的吗？会的\nhttps://bgm.tv/group/topic/410641\nhttps://bgm.tv/group/topic/410913\n\n反sai新赛道\nhttps://bgm.tv/group/topic/411744",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1711354259000,
                        "modifier": 1,
                        "modified": 1711354259000,
                        "extra": null,
                        "id": 4,
                        "monsterId": 8,
                        "cliqueId": 1,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1710834557000,
                            "modifier": 1,
                            "modified": 1722579558000,
                            "extra": null,
                            "id": 1,
                            "name": "牵手家族",
                            "score": -5,
                            "estTime": 1577808000000,
                            "estTimeFormat": "202?",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "又名古家军\n现根据地为斗蛐蛐群\n以古河为首的立志于造神的“战团”型小团体\n\n内部不稳\nhttps://bgm.tv/group/topic/403050",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "高",
                            "code": "1",
                            "field": "HIGH"
                        },
                        "joinTime": 1577808000000,
                        "joinTimeFormat": "202?",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        },
                        "mCStatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        }
                    }
                ]
            }
        },
        "847468": {
            "username": "847468",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711413450000,
                "modifier": 1,
                "modified": 1733397720000,
                "extra": null,
                "id": 16,
                "masterId": null,
                "master": null,
                "name": "嘻嘻",
                "bgmid": "847468",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "小号",
                    "code": "2",
                    "field": "SLAVE"
                },
                "cont": "常用名：我们都爱二次元\n拱火人",
                "mcs": []
            }
        },
        "794437": {
            "username": "794437",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1715165605000,
                "modifier": 1,
                "modified": 1733397893000,
                "extra": null,
                "id": 59,
                "masterId": null,
                "master": null,
                "name": "逆流之锚",
                "bgmid": "794437",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "疑似吹风折棒小团体成员\n喜欢胡搅蛮缠需要大脑升级",
                "mcs": []
            }
        },
        "630296": {
            "username": "630296",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1713512838000,
                "modifier": 1,
                "modified": 1733397865000,
                "extra": null,
                "id": 50,
                "masterId": null,
                "master": null,
                "name": "天风雨晨",
                "bgmid": "630296",
                "newbgmid": null,
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名：素裙天命\n\n“理智”粉\nhttps://bgm.tv/group/topic/397054\n\n孜孜不倦的战评分战排名，实际不是在乎这个只是想钓鱼\nhttps://bgm.tv/group/topic/406108\nhttps://bgm.tv/group/topic/406109\nhttps://bgm.tv/group/topic/406125\nhttps://bgm.tv/group/topic/406130\n（太多了，列举不完）\n\n这么久了怎么还在钓，水平也不见长进\nhttps://bgm.tv/group/topic/407365\nhttps://bgm.tv/group/topic/407488\n\n哥们有点M体质\nhttps://bgm.tv/group/topic/406651\n\n直言承认钓 鱼，已经不是一般的厚脸皮了（扣一分）\nhttps://bgm.tv/group/topic/408587#post_2955995",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1713512927000,
                        "modifier": 1,
                        "modified": 1713512927000,
                        "extra": null,
                        "id": 13,
                        "monsterId": 50,
                        "cliqueId": 4,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1711416388000,
                            "modifier": 1,
                            "modified": 1715848835000,
                            "extra": null,
                            "id": 4,
                            "name": "神户家族",
                            "score": -3,
                            "estTime": null,
                            "estTimeFormat": "",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "又名小德猫咖",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "低",
                            "code": "3",
                            "field": "LOW"
                        },
                        "joinTime": null,
                        "joinTimeFormat": "",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "可能神户家族外围粉丝",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        },
                        "mCStatus": {
                            "desc": "加 入",
                            "code": "1",
                            "field": "JOIN"
                        }
                    }
                ]
            }
        },
        "592056": {
            "username": "592056",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1730804960000,
                "modifier": 1,
                "modified": 1733447870000,
                "extra": null,
                "id": 139,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "592056",
                "newbgmid": null,
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "oky": {
            "username": "oky",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1733409568000,
                "modifier": 1,
                "modified": 1733409568000,
                "extra": null,
                "id": 149,
                "masterId": null,
                "master": null,
                "name": "okamiyu",
                "bgmid": "217060",
                "newbgmid": "oky",
                "score": 1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "翻了翻短评，写的都很认真\n\n即使是芙莉莲，看得 也很认真\nhttps://bgm.tv/group/topic/411003",
                "mcs": []
            }
        },
        "748427": {
            "username": "748427",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1712401786000,
                "modifier": 1,
                "modified": 1733804556000,
                "extra": null,
                "id": 39,
                "masterId": null,
                "master": null,
                "name": "2022",
                "bgmid": "748427",
                "newbgmid": null,
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名：2狗、符腾堡公爵\n喜欢帖子刷屏\n说了静静 还不静静\n\n说了半退网还是刷帖机\nhttps://bgm.tv/group/topic/399553#post_2754121\n\n买断制游戏等于逼氪游戏\nhttps://bgm.tv/group/topic/402157\n\n反买断制反魔怔了(扣一分)\nhttps://bgm.tv/group/topic/402574#post_2820199\n\n见不得“白胳膊”的巨婴\nhttps://bgm.tv/group/topic/403479\n\n2狗的求饶\nhttps://bgm.tv/group/topic/404158\n\n言而有信的2狗\nhttps://bgm.tv/group/topic/408912#post_2959546\n\n已经不是一般的2狗了，必须重拳出击\nhttps://bgm.tv/group/topic/410832\n\n见不得别人享受二次元的2狗是真的丑陋\nhttps://bgm.tv/group/topic/411563\n\n2狗到底在破防什么？(扣一分)\nhttps://bgm.tv/group/topic/411576\nhttps://bgm.tv/group/topic/411577\nhttps://bgm.tv/group/topic/411584",
                "mcs": []
            }
        },
        "arthur_0": {
            "username": "arthur_0",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1730333766000,
                "modifier": 1,
                "modified": 1733447865000,
                "extra": null,
                "id": 135,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "569015",
                "newbgmid": "arthur_0",
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "461761": {
            "username": "461761",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1712201009000,
                "modifier": 1,
                "modified": 1733397818000,
                "extra": null,
                "id": 36,
                "masterId": null,
                "master": null,
                "name": "haoge4399",
                "bgmid": "461761",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "评分小组拱火人\n\n转战lol\nhttps://bgm.tv/group/topic/408774\nhttps://bgm.tv/group/topic/408826\nhttps://bgm.tv/group/topic/408857\nhttps://bgm.tv/group/topic/408978\nhttps://bgm.tv/group/topic/409170\n",
                "mcs": []
            }
        },
        "uks_ask": {
            "username": "uks_ask",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711414349000,
                "modifier": 1,
                "modified": 1733397733000,
                "extra": null,
                "id": 20,
                "masterId": null,
                "master": null,
                "name": "uks",
                "bgmid": "482674",
                "newbgmid": "uks_ask",
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "韩漫仙女",
                "mcs": []
            }
        },
        "imlonelywalker": {
            "username": "imlonelywalker",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1713522455000,
                "modifier": 1,
                "modified": 1733397871000,
                "extra": null,
                "id": 52,
                "masterId": null,
                "master": null,
                "name": "皆川すみれ",
                "bgmid": "266798",
                "newbgmid": "imlonelywalker",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "伪君子",
                "mcs": []
            }
        },
        "edwardtee": {
            "username": "edwardtee",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1722358028000,
                "modifier": 1,
                "modified": 1733397968000,
                "extra": null,
                "id": 84,
                "masterId": null,
                "master": null,
                "name": "冥刑etmhr17",
                "bgmid": "849711",
                "newbgmid": "edwardtee",
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "屁大点事爱好者\nhttps://bgm.tv/group/topic/402887#post_2827736",
                "mcs": []
            }
        },
        "871364": {
            "username": "871364",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1715580999000,
                "modifier": 1,
                "modified": 1733397901000,
                "extra": null,
                "id": 62,
                "masterId": null,
                "master": null,
                "name": "121212",
                "bgmid": "871364",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "小号",
                    "code": "2",
                    "field": "SLAVE"
                },
                "cont": "疑似小号\n选择看日本动画片已经是在浪费时间了\nhttps://bgm.tv/group/topic/398317#post_2728695\n\n富哥想毫无道德负担的爆金币\nhttps://bgm.tv/group/topic/402671",
                "mcs": []
            }
        },
        "798230": {
            "username": "798230",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1733402927000,
                "modifier": 1,
                "modified": 1733403106000,
                "extra": null,
                "id": 148,
                "masterId": null,
                "master": null,
                "name": "我是一个卤蛋精",
                "bgmid": "798230",
                "newbgmid": null,
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "京吹3一分党在狗叫\nhttps://bgm.tv/subject/topic/31074#post_335398",
                "mcs": []
            }
        },
        "532180": {
            "username": "532180",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1728980874000,
                "modifier": 1,
                "modified": 1733398061000,
                "extra": null,
                "id": 110,
                "masterId": null,
                "master": null,
                "name": "纸垂",
                "bgmid": "532180",
                "newbgmid": null,
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "是的，常识不重要\nhttps://bgm.tv/group/topic/407528#post_2931044",
                "mcs": []
            }
        },
        "awesome_failure": {
            "username": "awesome_failure",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711354185000,
                "modifier": 1,
                "modified": 1733397696000,
                "extra": null,
                "id": 9,
                "masterId": null,
                "master": null,
                "name": "猥琐羊",
                "bgmid": "351360",
                "newbgmid": "awesome_failure",
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "抽PS5的3D人士\n\n爱国rpg\nhttps://bgm.tv/group/topic/405676",
                "mcs": []
            }
        },
        "hakula_1234567": {
            "username": "hakula_1234567",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1715230965000,
                "modifier": 1,
                "modified": 1733397898000,
                "extra": null,
                "id": 61,
                "masterId": null,
                "master": null,
                "name": "Hakula",
                "bgmid": "254570",
                "newbgmid": "hakula_1234567",
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "吹风折棒小团体理论润笔人",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1715339565000,
                        "modifier": 1,
                        "modified": 1715339565000,
                        "extra": null,
                        "id": 17,
                        "monsterId": 61,
                        "cliqueId": 6,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1715339481000,
                            "modifier": 1,
                            "modified": 1725774108000,
                            "extra": null,
                            "id": 6,
                            "name": "折棒吹风寝室",
                            "score": -4,
                            "estTime": 1704038400000,
                            "estTimeFormat": "2024",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "疑似脱胎于牵手家族，由折棒牵头组成\n\n折棒吹风连体婴儿闹分家，不知道离寝室解散还有多远\nhttps://bgm.tv/group/topic/405090\nhttps://bgm.tv/group/topic/405090#post_2876530\nhttps://bgm.tv/group/topic/405090#post_2876533",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "高",
                            "code": "1",
                            "field": "HIGH"
                        },
                        "joinTime": 1704038400000,
                        "joinTimeFormat": "2024",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        },
                        "mCStatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        }
                    }
                ]
            }
        },
        "zenolith": {
            "username": "zenolith",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1712547635000,
                "modifier": 1,
                "modified": 1733397844000,
                "extra": null,
                "id": 44,
                "masterId": null,
                "master": null,
                "name": "正锑",
                "bgmid": "574753",
                "newbgmid": "zenolith",
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "评分届踢“无意义”沙煲的洋洋自得的小鬼\n认为“评分本身无意义，但评价有意义”\nhttps://bangumi.tv/group/topic/388514#post_2591947",
                "mcs": []
            }
        },
        "546179": {
            "username": "546179",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1718262887000,
                "modifier": 1,
                "modified": 1733397926000,
                "extra": null,
                "id": 72,
                "masterId": null,
                "master": null,
                "name": "神原卫华",
                "bgmid": "546179",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "低能文爱玩家\nhttps://bgm.tv/group/topic/400045#post_2763597\n恬不知耻且毫无悔意的双标狗\nhttps://bgm.tv/group/topic/400731\nhttps://bgm.tv/group/topic/400777",
                "mcs": []
            }
        },
        "249165": {
            "username": "249165",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1713592952000,
                "modifier": 1,
                "modified": 1733397881000,
                "extra": null,
                "id": 55,
                "masterId": null,
                "master": null,
                "name": "神户高达",
                "bgmid": "249165",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名：匿名人士67936、空白字符、会引起页面 紊乱的昵称\n头像是蓝鸟，以前常用高达做头像\n永远拥护sai老板统治、钓术不亚于老白\n\n欢乐树朋友是子供向\nhttps://bgm.tv/group/topic/406731#post_2915034",
                "mcs": []
            }
        },
        "meddle00": {
            "username": "meddle00",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711375031000,
                "modifier": 1,
                "modified": 1733397718000,
                "extra": null,
                "id": 15,
                "masterId": null,
                "master": null,
                "name": "麦兜",
                "bgmid": "532149",
                "newbgmid": "meddle00",
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1711375044000,
                        "modifier": 1,
                        "modified": 1726215357000,
                        "extra": null,
                        "id": 9,
                        "monsterId": 15,
                        "cliqueId": 1,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1710834557000,
                            "modifier": 1,
                            "modified": 1722579558000,
                            "extra": null,
                            "id": 1,
                            "name": "牵手家族",
                            "score": -5,
                            "estTime": 1577808000000,
                            "estTimeFormat": "202?",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "又名古家军\n现根据地为斗蛐蛐群\n以古河为首的立志于造神的“战团”型小团体\n\n内部不稳\nhttps://bgm.tv/group/topic/403050",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "中",
                            "code": "2",
                            "field": "MIDDLE"
                        },
                        "joinTime": null,
                        "joinTimeFormat": "",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "退出",
                            "code": "2",
                            "field": "QUIT"
                        },
                        "mCStatus": {
                            "desc": "退出",
                            "code": "2",
                            "field": "QUIT"
                        }
                    }
                ]
            }
        },
        "761490": {
            "username": "761490",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1722268571000,
                "modifier": 1,
                "modified": 1733397958000,
                "extra": null,
                "id": 81,
                "masterId": null,
                "master": null,
                "name": "修学好古",
                "bgmid": "761490",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "主楼把自己摘干净，下面又开始“感觉你可能不大 愿意”\nhttps://bgm.tv/group/topic/402202#post_2810019\n\n问就是没恶意，连一句“反感”都不敢说，基本确认为双面人（扣一分）\nhttps://bgm.tv/group/topic/407514\n（还有其他各种bgmer小图）",
                "mcs": []
            }
        },
        "harryhaller": {
            "username": "harryhaller",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1730123191000,
                "modifier": 1,
                "modified": 1733447850000,
                "extra": null,
                "id": 123,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "879332",
                "newbgmid": "harryhaller",
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "soranomethod": {
            "username": "soranomethod",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711354140000,
                "modifier": 1,
                "modified": 1733397689000,
                "extra": null,
                "id": 7,
                "masterId": null,
                "master": null,
                "name": "小德",
                "bgmid": "281315",
                "newbgmid": "soranomethod",
                "score": -5,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "神户家族的建立者\n小德猫咖的头牌\n版谷米的玛丽皇后\n学传播学学的\n\n不装了，犯了傲慢之罪(扣一分)\nhttps://bgm.tv/group/topic/402922",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1711416414000,
                        "modifier": 1,
                        "modified": 1711416414000,
                        "extra": null,
                        "id": 11,
                        "monsterId": 7,
                        "cliqueId": 4,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1711416388000,
                            "modifier": 1,
                            "modified": 1715848835000,
                            "extra": null,
                            "id": 4,
                            "name": "神户家族",
                            "score": -3,
                            "estTime": null,
                            "estTimeFormat": "",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "又名小德猫咖",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "高",
                            "code": "1",
                            "field": "HIGH"
                        },
                        "joinTime": null,
                        "joinTimeFormat": "",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        },
                        "mCStatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        }
                    }
                ]
            }
        },
        "sakito333": {
            "username": "sakito333",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1730186595000,
                "modifier": 1,
                "modified": 1733447881000,
                "extra": null,
                "id": 131,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "678850",
                "newbgmid": "sakito333",
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "abracadabra": {
            "username": "abracadabra",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1728917672000,
                "modifier": 1,
                "modified": 1733398051000,
                "extra": null,
                "id": 106,
                "masterId": null,
                "master": null,
                "name": "缇亚拉",
                "bgmid": "253879",
                "newbgmid": "abracadabra",
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "各种帖子下面贴贴就算了，还特地 开新帖秀小团体\nhttps://bgm.tv/group/topic/407489",
                "mcs": []
            }
        },
        "438736": {
            "username": "438736",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711637025000,
                "modifier": 1,
                "modified": 1733397815000,
                "extra": null,
                "id": 35,
                "masterId": null,
                "master": null,
                "name": "先生",
                "bgmid": "438736",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "认为评分无意义却还在评分小组呆着",
                "mcs": []
            }
        },
        "309098": {
            "username": "309098",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711354869000,
                "modifier": 1,
                "modified": 1733397714000,
                "extra": null,
                "id": 14,
                "masterId": null,
                "master": null,
                "name": "Arclight",
                "bgmid": "309098",
                "newbgmid": null,
                "score": -5,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名：Bangumi皮带帅\n标准极端粉红、鹅友、 反以",
                "mcs": []
            }
        },
        "885608": {
            "username": "885608",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1733917471000,
                "modifier": 15,
                "modified": 1733917471000,
                "extra": null,
                "id": 150,
                "masterId": null,
                "master": null,
                "name": null,
                "bgmid": "885608",
                "newbgmid": null,
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": null,
                "mcs": []
            }
        },
        "525665": {
            "username": "525665",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1712546677000,
                "modifier": 1,
                "modified": 1733397836000,
                "extra": null,
                "id": 42,
                "masterId": null,
                "master": null,
                "name": "流流",
                "bgmid": "525665",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "自称“并不需要了解别人的观点”却指指点点\nhttps://bangumi.tv/group/topic/388514#post_2533570",
                "mcs": []
            }
        },
        "621515": {
            "username": "621515",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711634355000,
                "modifier": 1,
                "modified": 1733397811000,
                "extra": null,
                "id": 34,
                "masterId": null,
                "master": null,
                "name": "aquarium",
                "bgmid": "621515",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "兜售名词信息差",
                "mcs": []
            }
        },
        "didhdifed": {
            "username": "didhdifed",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711417269000,
                "modifier": 1,
                "modified": 1733397757000,
                "extra": null,
                "id": 27,
                "masterId": null,
                "master": null,
                "name": "小熊猫",
                "bgmid": "568999",
                "newbgmid": "didhdifed",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "网络暗恋塌房白月光",
                "mcs": []
            }
        },
        "211998": {
            "username": "211998",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711502155000,
                "modifier": 1,
                "modified": 1733397804000,
                "extra": null,
                "id": 32,
                "masterId": null,
                "master": null,
                "name": "秘则为花",
                "bgmid": "211998",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "不说人话造词谜语流\n化简为繁的高手",
                "mcs": []
            }
        },
        "448853": {
            "username": "448853",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1726664160000,
                "modifier": 1,
                "modified": 1733660133000,
                "extra": null,
                "id": 101,
                "masterId": null,
                "master": null,
                "name": "Asahi",
                "bgmid": "448853",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "幽默外宾在线爱国\nhttps://bgm.tv/group/topic/405677#post_2890459\n\n“支持极端宗教势力上台打击女性权益”\nhttps://bgm.tv/group/topic/411404#post_3012938\n\n擦，是仇女斗士\nhttps://bgm.tv/group/topic/411438#post_3013450",
                "mcs": []
            }
        },
        "whatasiger": {
            "username": "whatasiger",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1723042733000,
                "modifier": 1,
                "modified": 1733397992000,
                "extra": null,
                "id": 92,
                "masterId": null,
                "master": null,
                "name": "Whatasiger",
                "bgmid": "811644",
                "newbgmid": "whatasiger",
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "没本事还要学别人打分\nhttps://bgm.tv/group/topic/403326#post_2838122",
                "mcs": []
            }
        },
        "iceflower": {
            "username": "iceflower",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1722358144000,
                "modifier": 1,
                "modified": 1733397970000,
                "extra": null,
                "id": 85,
                "masterId": null,
                "master": null,
                "name": "紫晶冰雪花",
                "bgmid": "606012",
                "newbgmid": "iceflower",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "匪夷所思的毫无逻辑的粉红\nhttps://bgm.tv/group/topic/402887#post_2827691",
                "mcs": []
            }
        },
        "qq624130658": {
            "username": "qq624130658",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711348578000,
                "modifier": 1,
                "modified": 1733549823000,
                "extra": null,
                "id": 4,
                "masterId": null,
                "master": null,
                "name": "老悠",
                "bgmid": "200970",
                "newbgmid": "qq624130658",
                "score": 0,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "",
                "mcs": []
            }
        },
        "harbour": {
            "username": "harbour",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711415828000,
                "modifier": 1,
                "modified": 1733397754000,
                "extra": null,
                "id": 26,
                "masterId": null,
                "master": null,
                "name": "孙连城",
                "bgmid": "583574",
                "newbgmid": "harbour",
                "score": 0,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "故事会区长",
                "mcs": []
            }
        },
        "650688": {
            "username": "650688",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1713523589000,
                "modifier": 1,
                "modified": 1733397873000,
                "extra": null,
                "id": 53,
                "masterId": null,
                "master": null,
                "name": "国见佐彩",
                "bgmid": "650688",
                "newbgmid": null,
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "喜欢说别人“闲的”的闲人",
                "mcs": []
            }
        },
        "635400": {
            "username": "635400",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1712547831000,
                "modifier": 1,
                "modified": 1733397847000,
                "extra": null,
                "id": 45,
                "masterId": null,
                "master": null,
                "name": "Erika",
                "bgmid": "635400",
                "newbgmid": null,
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名：丛雨の幼刀\n嘴臭傻逼\nhttps://bgm.tv/group/topic/388514#post_2592432\n“谨慎打分”的mygo粉\nhttps://bgm.tv/group/topic/399366#post_2750714",
                "mcs": []
            }
        },
        "zeeee": {
            "username": "zeeee",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1716012660000,
                "modifier": 1,
                "modified": 1733397914000,
                "extra": null,
                "id": 68,
                "masterId": null,
                "master": null,
                "name": "ihanzeng1",
                "bgmid": "681207",
                "newbgmid": "zeeee",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "用什么头像发言能增强攻击性？\nhttps://bgm.tv/group/topic/398612\n\n想贴贴老悠被拒绝后恼羞成怒",
                "mcs": []
            }
        },
        "361485": {
            "username": "361485",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1722572115000,
                "modifier": 1,
                "modified": 1733397978000,
                "extra": null,
                "id": 88,
                "masterId": null,
                "master": null,
                "name": "老七样",
                "bgmid": "361485",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "典型逻辑不够现实来凑\nhttps://bgm.tv/group/topic/402887#post_2830167",
                "mcs": []
            }
        },
        "sai": {
            "username": "sai",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1713527577000,
                "modifier": 1,
                "modified": 1733994679000,
                "extra": null,
                "id": 54,
                "masterId": null,
                "master": null,
                "name": "Sai",
                "bgmid": "1",
                "newbgmid": "sai",
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "仁慈的安人皇帝\n永远公正独裁官\n\n删建政更删反贼，是自保还是双标？\n\n巨魔钓鱼不管，挂巨魔钓鱼的管的怪勤(扣一分)",
                "mcs": []
            }
        },
        "kongzhi": {
            "username": "kongzhi",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1713522231000,
                "modifier": 1,
                "modified": 1734003139000,
                "extra": null,
                "id": 51,
                "masterId": null,
                "master": null,
                "name": "空织",
                "bgmid": "818765",
                "newbgmid": "kongzhi",
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "不知道哪来的虚伪贵物\n\n布朗打分爱好者(扣 一分)\nhttps://bgm.tv/group/topic/403326#post_2838130\n\n不知道受了什么刺激，唐突挖坟又开婊\nhttps://bgm.tv/group/topic/410068\n\n以问作答，此人已习得无上汴京法\nhttps://bgm.tv/group/topic/405001\nhttps://bgm.tv/group/topic/410515\nhttps://bgm.tv/group/topic/410920\n\n疯狂挖坟骚扰\nhttps://bgm.tv/group/topic/392257#post_3002830\nhttps://bgm.tv/group/topic/407555#post_3002843\nhttps://bgm.tv/group/topic/401255#post_3002849\nhttps://bgm.tv/group/topic/402887#post_3002850\nhttps://bgm.tv/group/topic/401201#post_3002845\n\n跟踪挖坟狗怎么敢指责别人骚扰的？\nhttps://bgm.tv/group/topic/410068#post_3008199\n\n疯狂的丑态有类2狗(扣一分)\nhttps://bgm.tv/group/topic/411746\n\n疯狗又开始了\nhttps://bgm.tv/group/topic/411783",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1731491981000,
                        "modifier": 1,
                        "modified": 1731491981000,
                        "extra": null,
                        "id": 21,
                        "monsterId": 51,
                        "cliqueId": 8,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1731491923000,
                            "modifier": 1,
                            "modified": 1731492932000,
                            "extra": null,
                            "id": 8,
                            "name": "空织小魔女群",
                            "score": -2,
                            "estTime": null,
                            "estTimeFormat": "",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "具体成分不清楚，但头子空织素质这么低想必也好不到哪去",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "高",
                            "code": "1",
                            "field": "HIGH"
                        },
                        "joinTime": null,
                        "joinTimeFormat": "",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        },
                        "mCStatus": {
                            "desc": "加入",
                            "code": "1",
                            "field": "JOIN"
                        }
                    }
                ]
            }
        },
        "harukizzp": {
            "username": "harukizzp",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711415469000,
                "modifier": 1,
                "modified": 1733397751000,
                "extra": null,
                "id": 25,
                "masterId": null,
                "master": null,
                "name": "加藤哥",
                "bgmid": "407378",
                "newbgmid": "harukizzp",
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "瓢虫",
                "mcs": []
            }
        },
        "791458": {
            "username": "791458",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1714361544000,
                "modifier": 1,
                "modified": 1733397887000,
                "extra": null,
                "id": 57,
                "masterId": null,
                "master": null,
                "name": "点燃羊🐏单推人",
                "bgmid": "791458",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "巨魔指责别人巨魔",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1714361732000,
                        "modifier": 1,
                        "modified": 1714361732000,
                        "extra": null,
                        "id": 14,
                        "monsterId": 57,
                        "cliqueId": 1,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1710834557000,
                            "modifier": 1,
                            "modified": 1722579558000,
                            "extra": null,
                            "id": 1,
                            "name": "牵手家族",
                            "score": -5,
                            "estTime": 1577808000000,
                            "estTimeFormat": "202?",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "又名古家军\n现根据地为斗蛐蛐群\n以古河为首的立志于造神的“战团”型小团体\n\n内部不稳\nhttps://bgm.tv/group/topic/403050",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "低",
                            "code": "3",
                            "field": "LOW"
                        },
                        "joinTime": null,
                        "joinTimeFormat": "",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "疑似加入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        },
                        "mCStatus": {
                            "desc": "疑 似加入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        }
                    }
                ]
            }
        },
        "799599": {
            "username": "799599",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1722868741000,
                "modifier": 1,
                "modified": 1733397988000,
                "extra": null,
                "id": 91,
                "masterId": null,
                "master": null,
                "name": "奶龙",
                "bgmid": "799599",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "都叫奶龙了",
                "mcs": []
            }
        },
        "217781": {
            "username": "217781",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711414561000,
                "modifier": 1,
                "modified": 1733909318000,
                "extra": null,
                "id": 21,
                "masterId": null,
                "master": null,
                "name": "金刚可怜",
                "bgmid": "217781",
                "newbgmid": null,
                "score": -5,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "流水线色图量产者\n撸出血的百合豚\n\n这下真成“无可救药的百合豚”了\nhttps://bgm.tv/group/topic/399004\n\n逐渐巨魔化(扣一分)\nhttps://bgm.tv/group/topic/402220\n\n骗贴贴骗上瘾了\nhttps://bgm.tv/group/topic/403670\n\n“如果”贴爱好者\n如果不发这些没营养的帖子他就跟二次元一点交集都没有了\nhttps://bgm.tv/group/topic/403782\n\n偷窥她人聊天记录(扣一分)\nhttps://bgm.tv/group/topic/405110\n\n多次吹二游贬gal\nhttps://bgm.tv/group/topic/405578\n\n河豚鄙视中年臭\nhttps://bgm.tv/group/topic/405671#post_2890160\n\n不得不说巨魔可怜在贴贴上有一手，你贴问号就相当于同意他隐含的观点，不贴又无法表达对其的反感\nhttps://bgm.tv/group/topic/408379\n\n金刚可怜为什么还守着版谷米 这一亩三分地？(扣一分)\nhttps://bgm.tv/group/topic/409537\n\n只会直球钓鱼的金刚可怜是劣等巨魔\nhttps://bgm.tv/group/topic/409726\n\n“gal都是垃圾，不服来辩”\nhttps://bgm.tv/group/topic/410234\n\n因少女乐队 而破防\nhttps://bgm.tv/group/topic/411674",
                "mcs": []
            }
        },
        "616197": {
            "username": "616197",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1715581386000,
                "modifier": 1,
                "modified": 1733397903000,
                "extra": null,
                "id": 63,
                "masterId": null,
                "master": null,
                "name": "聊聊",
                "bgmid": "616197",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "是看动画还是看评分啊\nhttps://bgm.tv/group/topic/398317#post_2728690",
                "mcs": []
            }
        },
        "panacea": {
            "username": "panacea",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711354793000,
                "modifier": 1,
                "modified": 1733397708000,
                "extra": null,
                "id": 13,
                "masterId": null,
                "master": null,
                "name": "灵药",
                "bgmid": "340333",
                "newbgmid": "panacea",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "牵手家族老成员",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1711354816000,
                        "modifier": 1,
                        "modified": 1711354816000,
                        "extra": null,
                        "id": 8,
                        "monsterId": 13,
                        "cliqueId": 1,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1710834557000,
                            "modifier": 1,
                            "modified": 1722579558000,
                            "extra": null,
                            "id": 1,
                            "name": "牵手家族",
                            "score": -5,
                            "estTime": 1577808000000,
                            "estTimeFormat": "202?",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "又名古家军\n现根据地为斗蛐蛐群\n以古河为首的立志于造神的“战团”型小团体\n\n内部不稳\nhttps://bgm.tv/group/topic/403050",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "中",
                            "code": "2",
                            "field": "MIDDLE"
                        },
                        "joinTime": null,
                        "joinTimeFormat": "",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "疑似加入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        },
                        "mCStatus": {
                            "desc": "疑似加 入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        }
                    }
                ]
            }
        },
        "a10100wo": {
            "username": "a10100wo",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1722747824000,
                "modifier": 1,
                "modified": 1733397981000,
                "extra": null,
                "id": 89,
                "masterId": null,
                "master": null,
                "name": "みたいなっ",
                "bgmid": "232224",
                "newbgmid": "a10100wo",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "爱发萌新提问帖，老是发就比较巨魔了\n老一辈渔夫，但钓术过于古老早该退役了",
                "mcs": []
            }
        },
        "581174": {
            "username": "581174",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1722394852000,
                "modifier": 1,
                "modified": 1733397973000,
                "extra": null,
                "id": 86,
                "masterId": null,
                "master": null,
                "name": "哗哗",
                "bgmid": "581174",
                "newbgmid": null,
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "没ai就不会说话了\nhttps://bgm.tv/group/topic/402930",
                "mcs": []
            }
        },
        "823450": {
            "username": "823450",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1712547319000,
                "modifier": 1,
                "modified": 1733397838000,
                "extra": null,
                "id": 43,
                "masterId": null,
                "master": null,
                "name": "星岛彼方",
                "bgmid": "823450",
                "newbgmid": null,
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "评分届的孔乙己\n“微平衡”与“个人向小刷”的创造者\nhttps://bangumi.tv/group/topic/388514#post_2560548",
                "mcs": []
            }
        },
        "mikosama": {
            "username": "mikosama",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1726662441000,
                "modifier": 1,
                "modified": 1733398017000,
                "extra": null,
                "id": 100,
                "masterId": null,
                "master": null,
                "name": "勤务员",
                "bgmid": "455329",
                "newbgmid": "mikosama",
                "score": -3,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名：Nhk驻Bangumi首席总干事、大中 华帝国驻幕府常务使臣、真理报社评\n\n捅小孩B大点事，仇日全靠抖音搜\nhttps://bgm.tv/group/topic/405677#post_2890239",
                "mcs": []
            }
        },
        "689504": {
            "username": "689504",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1728972816000,
                "modifier": 1,
                "modified": 1733398053000,
                "extra": null,
                "id": 107,
                "masterId": null,
                "master": null,
                "name": "巴黎雨夕",
                "bgmid": "689504",
                "newbgmid": null,
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "不是反做题，是反智\nhttps://bgm.tv/group/topic/407528#post_2930902",
                "mcs": []
            }
        },
        "diancie": {
            "username": "diancie",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1711417330000,
                "modifier": 1,
                "modified": 1733397760000,
                "extra": null,
                "id": 28,
                "masterId": null,
                "master": null,
                "name": "incontri",
                "bgmid": "626538",
                "newbgmid": "diancie",
                "score": -2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "经常换号的社科JK",
                "mcs": []
            }
        },
        "883457": {
            "username": "883457",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1732688937000,
                "modifier": 1,
                "modified": 1733398105000,
                "extra": null,
                "id": 144,
                "masterId": null,
                "master": null,
                "name": "Nokes",
                "bgmid": "883457",
                "newbgmid": null,
                "score": -2,
                "type": {
                    "desc": "小号",
                    "code": "2",
                    "field": "SLAVE"
                },
                "cont": "古河仇人开小号？\nhttps://bgm.tv/group/topic/410556\nhttps://bgm.tv/group/topic/410529\nhttps://bgm.tv/group/topic/410372",
                "mcs": []
            }
        },
        "auppyanthony": {
            "username": "auppyanthony",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1723770967000,
                "modifier": 1,
                "modified": 1733397996000,
                "extra": null,
                "id": 93,
                "masterId": null,
                "master": null,
                "name": "otaku",
                "bgmid": "60431",
                "newbgmid": "auppyanthony",
                "score": 2,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "国产游戏高手，特别是老游戏方面阅 历很高\n爱写博客，但似乎已断更\nhttp://www.9imx.com/\n\nBangumi广州群群主",
                "mcs": []
            }
        },
        "juzhangbushijuz": {
            "username": "juzhangbushijuz",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 15,
                "created": 1730186057000,
                "modifier": 1,
                "modified": 1733447855000,
                "extra": null,
                "id": 129,
                "masterId": null,
                "master": null,
                "name": "",
                "bgmid": "860718",
                "newbgmid": "juzhangbushijuz",
                "score": null,
                "type": {
                    "desc": "未知",
                    "code": "0",
                    "field": "UNKNOWN"
                },
                "cont": "",
                "mcs": []
            }
        },
        "907298": {
            "username": "907298",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1727190150000,
                "modifier": 1,
                "modified": 1733398040000,
                "extra": null,
                "id": 103,
                "masterId": null,
                "master": null,
                "name": "莱因哈特",
                "bgmid": "907298",
                "newbgmid": null,
                "score": 0,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "疑似炒作，先加入观察列表\nhttps://bgm.tv/group/topic/406035",
                "mcs": [
                    {
                        "status": {
                            "desc": "有效",
                            "code": "1",
                            "field": "VALID"
                        },
                        "creator": 1,
                        "created": 1733139410000,
                        "modifier": 1,
                        "modified": 1733139872000,
                        "extra": null,
                        "id": 22,
                        "monsterId": 103,
                        "cliqueId": 8,
                        "clique": {
                            "status": {
                                "desc": "有效",
                                "code": "1",
                                "field": "VALID"
                            },
                            "creator": 1,
                            "created": 1731491923000,
                            "modifier": 1,
                            "modified": 1731492932000,
                            "extra": null,
                            "id": 8,
                            "name": "空织小魔女群",
                            "score": -2,
                            "estTime": null,
                            "estTimeFormat": "",
                            "dissTime": null,
                            "dissTimeFormat": "",
                            "cont": "具体成分不清楚，但头子空织素质这么低想必也好不到哪去",
                            "timeOffset": "+08:00",
                            "cstatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            },
                            "cStatus": {
                                "desc": "存活",
                                "code": "1",
                                "field": "ALIVE"
                            }
                        },
                        "level": {
                            "desc": "未知",
                            "code": "0",
                            "field": "UNKNOWN"
                        },
                        "joinTime": null,
                        "joinTimeFormat": "",
                        "quitTime": null,
                        "quitTimeFormat": "",
                        "cont": "貌似互相很熟\nhttps://bgm.tv/group/topic/406035#post_2898713\nhttps://bgm.tv/group/topic/410920#post_3002568",
                        "timeOffset": "+08:00",
                        "mcstatus": {
                            "desc": "疑似加入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        },
                        "mCStatus": {
                            "desc": "疑似加入",
                            "code": "3",
                            "field": "SUS_JOIN"
                        }
                    }
                ]
            }
        },
        "zq0504032": {
            "username": "zq0504032",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1723771250000,
                "modifier": 1,
                "modified": 1733398002000,
                "extra": null,
                "id": 94,
                "masterId": null,
                "master": null,
                "name": "满舰饰假子",
                "bgmid": "206779",
                "newbgmid": "zq0504032",
                "score": 1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "历史爱好者，喜欢在史书里找怪东西",
                "mcs": []
            }
        },
        "641082": {
            "username": "641082",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1729242678000,
                "modifier": 1,
                "modified": 1733398066000,
                "extra": null,
                "id": 112,
                "masterId": null,
                "master": null,
                "name": "小P",
                "bgmid": "641082",
                "newbgmid": null,
                "score": -1,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "16岁以后还喜欢看动画片的人真的正常吗\nhttps://bgm.tv/group/topic/407365#post_2935410",
                "mcs": []
            }
        },
        "644645": {
            "username": "644645",
            "data": {
                "status": {
                    "desc": "有效",
                    "code": "1",
                    "field": "VALID"
                },
                "creator": 1,
                "created": 1716364181000,
                "modifier": 1,
                "modified": 1733397923000,
                "extra": null,
                "id": 70,
                "masterId": null,
                "master": null,
                "name": "纯良甜甜酱",
                "bgmid": "644645",
                "newbgmid": null,
                "score": -4,
                "type": {
                    "desc": "主号",
                    "code": "1",
                    "field": "MASTER"
                },
                "cont": "常用名：胡桃酱、喜欢肥伦、喜欢沙拉\n瞧不起动漫却喜欢逛动漫社区\n买热搜的饭圈\nhttps://bgm.tv/group/topic/390331",
                "mcs": []
            }
        }
        // 其他用户数据...
    };

    // 初始化 EmailJS（请替换为你的用户ID）
    emailjs.init('-kufoNTw8PGnHG47S');

    // 添加你的原始样式和功能
    const style = document.createElement('style');
    style.textContent = `
    /* 定义用户名链接的样式 */
    .user-link-tooltip {
        position: relative;
        cursor: pointer;
    }
    /* 定义提示的样式 */
    .user-link-tooltip::after {
        content: attr(data-tooltip);
        position: absolute;
        top: 110%;
        left: 0;
        transform: translateX(0);
        background-color: #fff;
        color: #000;
        padding: 5px;
        border: 1px solid #ccc;
        border-radius: 4px;
        white-space: pre-wrap;
        z-index: 1000;
        width: 350px;
        box-sizing: border-box;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        display: none;
    }
    /* 当鼠标悬停时显示提示 */
    .user-link-tooltip:hover::after {
        display: block;
    }
    `;
    document.head.appendChild(style);

    // 提取用户ID的函数
    function extractUsername(element) {
        let href = element.getAttribute('href');
        if (href && href.startsWith('/user/')) {
            let username = href.substring('/user/'.length);
            // 移除可能的查询参数或片段标识符
            username = username.split('?')[0].split('#')[0];
            return username;
        }
        return null;
    }

    // 处理用户链接的函数
    function processUserLinks() {
        const userLinks = document.querySelectorAll(
            '.userName a[href^="/user/"], ' +         // 第一种回帖者用户名链接
            '.userInfo strong a[href^="/user/"], ' +  // 第二种回帖者用户名链接
            'a.l[href^="/user/"]'                     // 发帖者用户名链接
        );

        userLinks.forEach(link => {
            const username = extractUsername(link);

            if (username && userDataMap[username]) {
                // 用户名在映射中存在
                const userData = userDataMap[username].data;
                const score = userData.score;
                const cont = userData.cont;
                const name = userData.name;

                // 根据score设置用户名颜色
                if (score === -1) {
                    link.style.color = 'lightPink';
                } else if (score === -2 || score === -3) {
                    link.style.color = 'hotPink';
                } else if (score === -4 || score === -5) {
                    link.style.color = 'red';
                } else if(score === 0){
                    link.style.color = 'gray';
                } else if(score === 1){
                    link.style.color = 'lightGreen';
                } else if(score === 2 || score === 3){
                    link.style.color = 'lawnGreen';
                } else if(score === 4|| score === 5){
                    link.style.color = 'Green';
                }

                // 准备显示的内容
                let dataContent = `${name} 淳朴度: ${score}\n ${cont}`;

                if (userData.mcs && Array.isArray(userData.mcs)) {
                    userData.mcs.forEach((mc, index) => {
                        if (mc.clique) {
                            const clique = mc.clique;
                            const cliqueName = clique.name || '未知 Clique 名称';
                            const cliqueCont = clique.cont || '无内容';
                            // 追加 clique 信息到 dataContent
                            dataContent += `\n ${cliqueName}\n${cliqueCont}`;
                        }
                    });
                }

                // 添加悬停提示
                link.setAttribute('data-tooltip', dataContent);
                // 添加 CSS 类
                link.classList.add('user-link-tooltip');
            }
        });
    }


    // 添加点击事件监听器到目标元素
    function addClickListeners() {
        // 只匹配楼层操作菜单中的“三个点”，避免误伤同样使用
        // `.action.dropdown > a.icon` 结构的顺序/倒序菜单。
        const moreButtons = Array.from(
            document.querySelectorAll('div.action.dropdown > a.icon > .ico_more'),
            moreIcon => moreIcon.parentElement
        );

        moreButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault(); // 阻止默认行为
                showInputPopup(button);
            });
        });
    }






function showInputPopup(targetButton) {
    // **新增：在此处获取需要的数据**

    // 获取父元素，找到包含 `onclick` 属性的元素
    let subReplyElement = null;

    // 尝试在 targetButton 的祖先元素中查找
    let parent = targetButton.parentElement;
    while (parent) {
        subReplyElement = parent.querySelector('a[onclick^="subReply"]');
        if (subReplyElement) {
            break;
        }
        parent = parent.parentElement;
    }

    // 如果找不到，发出提示
    if (!subReplyElement) {
        alert('无法找到 subReply 信息，无法构造链接。');
        return;
    }

    // 获取 onclick 属性内容
    const onclickContent = subReplyElement.getAttribute('onclick');
    // console.log('Onclick Content:', onclickContent);

    // 使用正则表达式解析数字
    // 示例：subReply('group', 411964, 3025847, 3025853, 609137, 253879, 1)
    const regex = /subReply\('group',\s*(\d+),\s*(\d+)/;
    const match = onclickContent.match(regex);

    if (!match || match.length < 3) {
        alert('解析 subReply 信息失败。');
        return;
    }

    const groupId = match[1];
    const postId = match[2];

    // 构造目标 URL
    const targetUrl = `https://bangumi.tv/group/topic/${groupId}#post_${postId}`;
    // console.log('Target URL:', targetUrl);

    // 以下是弹出框的创建代码

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '10000';
    document.body.appendChild(overlay);

    // 创建弹出框容器
    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.width = '400px';
    popup.style.backgroundColor = '#fff';
    popup.style.padding = '20px';
    popup.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
    popup.style.borderRadius = '5px';
    popup.style.zIndex = '10001';

    // 创建关闭按钮
    const closeButton = document.createElement('span');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '15px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '20px';
    popup.appendChild(closeButton);

    // 创建标题
    const title = document.createElement('h3');
    title.textContent = '请输入内容';
    popup.appendChild(title);

    // 创建文本框
    const textarea = document.createElement('textarea');
    textarea.placeholder = '请输入要发送的内容...';
    textarea.style.width = '100%';
    textarea.style.height = '150px';
    popup.appendChild(textarea);

    // 创建提交按钮
    const submitButton = document.createElement('button');
    submitButton.textContent = '提交';
    submitButton.style.marginTop = '10px';
    submitButton.style.width = '100%';
    submitButton.style.padding = '10px';
    submitButton.style.cursor = 'pointer';
    popup.appendChild(submitButton);

    // 将弹出框添加到页面
    document.body.appendChild(popup);

    // 关闭弹出框的函数
    function closePopup() {
        document.body.removeChild(popup);
        document.body.removeChild(overlay);
    }

    // 点击关闭按钮或遮罩层，关闭弹出框
    closeButton.addEventListener('click', closePopup);
    overlay.addEventListener('click', closePopup);

    // 点击提交按钮时处理输入内容
    submitButton.addEventListener('click', function() {
        const content = textarea.value.trim();
        if (content === '') {
            alert('请输入内容后再提交。');
            return;
        }

        const templateParams = {
            message: content,
            url: targetUrl // 添加目标 URL 到模板参数中
        };

        emailjs.send('service_9oj99f9', 'template_s3l0wmg', templateParams)
        .then(function(response) {
            console.log('邮件发送成功！', response.status, response.text);
            alert('邮件发送成功！');
            // 清理并关闭弹出框
            textarea.value = '';
            closePopup();
        }, function(error) {
            console.error('邮件发送失败...', error);
            alert('邮件发送失败，请检查控制台以获取详细信息。错误代码：' + error.status);
            if (error && error.text) {
                console.error('服务器返回的错误信息：', error.text);
            }
        });
    });
}

// 在 DOMContentLoaded 之后运行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addClickListeners);
} else {
    addClickListeners();
    processUserLinks();
}
})();
