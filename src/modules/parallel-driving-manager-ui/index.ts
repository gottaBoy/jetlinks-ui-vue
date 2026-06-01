const routerModules = import.meta.glob('./views/**/index.vue')
import { defineAsyncComponent } from 'vue';
import i18n from "@/locales";

const MODULE_CODE = 'parallel-driving'

const getAsyncRoutesMap = () => {
    const modules = {}
    Object.keys(routerModules).forEach(item => {
        const code = item.replace('./views/', '').replace('/index.vue', '')
        const key = `${code}`
        modules[key] = routerModules[item]
    })

    return modules
}

const getExtraRoutesMap = () => {
    return {
        'vehicle-list': {
            children: [
                {
                    code: 'detail',
                    url: '/detail/:id',
                    name: '车辆详情',
                    component: () => import('./views/vehicle-list/detail/index.vue')
                },
                {
                    code: 'remote-focus',
                    url: '/remote-focus/:id',
                    name: '远控工作台',
                    component: () => import('./views/vehicle-list/remote-focus/index.vue'),
                },
                {
                    code: 'ultrawide',
                    url: '/ultrawide/:id',
                    name: '曲面屏沉浸台',
                    component: () => import('./views/vehicle-list/ultrawide/index.vue'),
                },
                {
                    code: 'job-config',
                    url: '/job-config',
                    name: '任务运营',
                    component: () => import('./views/vehicle-list/job-config/JobConfigPage.vue'),
                },
            ]
        }
    }
}

const getComponents = () => {
    return {}
}

const aliasName = 'parallel-driving'

export default {
    getAsyncRoutesMap,
    getExtraRoutesMap,
    getComponents,
    aliasName
}

